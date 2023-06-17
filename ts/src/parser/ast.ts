import { Iterator, assert } from "../utils.js";
import { parseTokensToGroupScope } from "./tokenGroups.js";
import { parseTokens } from "./tokens.js";
import {
  ParsingError,
  ParsingResult,
  Scope,
  FlatSyntaxTree,
  TokenGroupSeparatorChildren,
  ConsumeParsingResult,
  TokenGroupDefinition,
} from "./types.js";

/* 
Pratt's Parsing algorithm:

Input: 
1. source tokenized operator instance to be parsed
2. starting index in top children of operator instance
3. min "precedence" of operators to be parsed.
4. scope of "operator", that is being parsed - dictionary of possible "operators", which includes:
  1. sequence of "separators", which include:
    1. list of separator's definition tokens
    2. number of repeats allowed for that separator
    3. optional "scope" generator, that accepts enclosing scope 
       and returns new scope to use while parsing its children, identity by default. Only used if min repeats > 0


Output:
1. Final index after parsing "node"
2. parsed "node", that is either a "prefix", "postfix", "infix", or "atom" node
3. List of errors that occured during parsing

Instructions: 

1. Initialize variables:
  1. index as the starting index i.
  2. token as the current token at src[index].
  3. errors as an empty array.
  4. lhs as null (to be assigned later).
2. if token is whitespace token - skip it.
3. if it is the end of stream - return an error.
4. Check the type of token:
  1. If it is an "identifier", "number", or "string", increment index and assign lhs as a syntax tree node with token as its item.
  2. If it is an "operator", check its precedence level in the scope:
    If the operator is prefix operator - parse operand with operator's precedence as min precedence. Assign the result to rhs and update index.
    If the operator is none-fix operator - increment index and assign lhs as a syntax tree node with token as its item.
    If the operator is postfix operator - return an error
    If the operator is infix operator - return an error
5. Enter a loop:
  1. Update token with the current token at src[index].
  2. if token is whitespace token - skip it.
  3. If token is null, break the loop.
  4. If token is not an operator - return an error.
  5. Check the precedence of token in the scope:
    1. If the left precedence is null or less than min precedence, break the loop.
    2. Increment index.
    3. If the right precedence is null, assign lhs as a syntax tree node with token as its item and lhs as its lhs.
    4. If the right precedence is not null - parse operand with operator's precedence as min precedence. Assign the result to rhs and update index.
    5. Assign lhs as a syntax tree node with token as its item, lhs as its lhs, and rhs as its rhs.
6.Return [index, lhs, errors] as the final result of parsing the separator children.
*/

export const parseTokensToAST = (
  src: TokenGroupSeparatorChildren,
  i: number,
  precedence: number,
  scope: Scope
): ParsingResult<FlatSyntaxTree> => {
  const reducedScope = Iterator.iterEntries(scope)
    .filter(([_, operatorDefinition]) => operatorDefinition.precedence[0] !== null)
    .toObject();
  let index = i;
  const errors: ParsingError[] = [];
  let lhs: FlatSyntaxTree;

  //skip possible whitespace prefix
  {
    const token = src[index];
    if (token.type === "newline" || token.type === "whitespace") {
      index++;
    }
  }

  {
    // no postfix/infix operators
    const reducedScope = Iterator.iterEntries(scope)
      .filter(([_, operatorDefinition]) => operatorDefinition.precedence[0] === null)
      .map<[string, TokenGroupDefinition]>(([id, def]) => [
        id,
        { ...def, separators: def.separators.map((sep) => ({ scope: () => scope, ...sep })) },
      ])
      .toObject();
    const [nextIndex, token] = parseTokensToGroupScope(src, index, reducedScope) ?? [index + 1, src[index]];

    if (!token) return [index, { item: { type: "whitespace", src: "" } }, [...errors, { message: "end of stream" }]];
    index = nextIndex;

    if (token.type === "identifier" || token.type === "number" || token.type === "string") {
      lhs = { item: token };
    } else {
      assert(token.type === "operator");
      const { precedence } = scope[token.id];
      const [, right] = precedence;

      if (right !== null) {
        const [nextIndex, rhs, _errors] = parseTokensToAST(src, index, right, scope);

        index = nextIndex;
        errors.push(..._errors);
        lhs = { item: token, rhs };
      } else {
        index++;
        lhs = { item: token };
      }
    }
  }

  while (true) {
    //skip possible whitespace prefix
    {
      if (!src[index]) break;

      const token = src[index];
      if (token && (token.type === "newline" || token.type === "whitespace")) {
        index++;
      }

      if (!src[index]) break;
    }

    const [nextIndex, token] = parseTokensToGroupScope(src, index, reducedScope) ?? [index + 1, src[index]];

    if (token.type !== "operator") break;

    const {
      precedence: [left, right],
    } = scope[token.id];

    if (left === null || left < precedence) break;
    index = nextIndex;

    if (right === null) {
      lhs = { item: token, lhs };
    } else {
      const [nextIndex, rhs, _errors] = parseTokensToAST(src, index, right, scope);

      index = nextIndex;
      errors.push(..._errors);
      lhs = { item: token, lhs, rhs };
    }
  }
  return [index, lhs, errors];
};

export const parseTokensToASTs = (
  src: TokenGroupSeparatorChildren,
  i: number,
  scope: Scope
): ConsumeParsingResult<FlatSyntaxTree[]> => {
  const ast: FlatSyntaxTree[] = [];
  const errors: ParsingError[] = [];
  let index = i;

  while (src[index]) {
    const [_index, astNode, _errors] = parseTokensToAST(src, index, 0, scope);

    if (_errors.length > 0) {
      ast.push({ item: src[index++] });
      continue;
    }

    index = _index;
    ast.push(astNode);
    errors.push(..._errors);
  }

  return [ast, errors];
};
export const parseGroupsToAST = (
  src: TokenGroupSeparatorChildren,
  i: number,
  precedence: number,
  scope: Scope
): ParsingResult<FlatSyntaxTree> => {
  let index = i;
  const errors: ParsingError[] = [];
  let lhs: FlatSyntaxTree;

  {
    const token = src[index];
    //skip possible whitespace prefix
    if (token.type === "newline" || token.type === "whitespace") {
      index++;
    }
  }

  {
    const token = src[index];
    if (!token) return [index, { item: { type: "whitespace", src: "" } }, [...errors, { message: "end of stream" }]];

    if (token.type === "identifier" || token.type === "number" || token.type === "string") {
      index++;
      lhs = { item: token };
    } else {
      assert(token.type === "operator");
      const { precedence } = scope[token.id];
      const [left, right] = precedence;

      if (left === null && right !== null) {
        const [nextIndex, rhs, _errors] = parseGroupsToAST(src, index + 1, right, scope);

        index = nextIndex;
        errors.push(..._errors);
        lhs = { item: token, rhs };
      } else if (left === null && right === null) {
        index++;

        lhs = { item: token };
      } else if (left !== null && right === null) {
        return [
          index,
          { item: { type: "whitespace", src: "" } },
          [...errors, { message: "postfix operator without left operand" }],
        ];
      } else {
        return [
          index,
          { item: { type: "whitespace", src: "" } },
          [...errors, { message: "infix operator without left operand" }],
        ];
      }
    }
  }

  while (true) {
    let token = src[index];

    if (!token) break;
    if (token.type === "newline" || token.type === "whitespace") {
      index++;
      token = src[index];
    }

    if (!token) break;
    if (token.type !== "operator") {
      return [index, lhs, errors];
    }

    const {
      precedence: [left, right],
    } = scope[token.id];

    if (left === null || left < precedence) break;
    index++;

    if (right === null) {
      lhs = { item: token, lhs };
    } else {
      const [nextIndex, rhs, _errors] = parseGroupsToAST(src, index, right, scope);

      index = nextIndex;
      errors.push(..._errors);
      lhs = { item: token, lhs, rhs };
    }
  }
  return [index, lhs, errors];
};

export const parseGroupsToASTs = (
  src: TokenGroupSeparatorChildren,
  i: number,
  scope: Scope
): ConsumeParsingResult<FlatSyntaxTree[]> => {
  const ast: FlatSyntaxTree[] = [];
  const errors: ParsingError[] = [];
  let index = i;

  while (src[index]) {
    const [_index, astNode, _errors] = parseGroupsToAST(src, index, 0, scope);

    if (_errors.length > 0) {
      ast.push({ item: src[index++] });
      continue;
    }

    index = _index;
    ast.push(astNode);
    errors.push(..._errors);
  }

  return [ast, errors];
};

export const parseStringToAST = (src: string, i: number, scope: Scope): ConsumeParsingResult<FlatSyntaxTree[]> => {
  const [children, errors] = parseTokens(src, i);
  const [ast, _errors] = parseTokensToASTs(children, 0, scope);

  return [ast, [...errors, ..._errors]];
};
