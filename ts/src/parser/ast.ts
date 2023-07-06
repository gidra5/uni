import { Iterator, assert } from "../utils.js";
import { parseTokensToGroupScope } from "./tokenGroups.js";
import { parseTokens, stringifyToken } from "./tokens.js";
import {
  ParsingError,
  ParsingResult,
  Scope,
  FlatSyntaxTree,
  ConsumeParsingResult,
  TokenGroupDefinition,
  TokenGroupSeparatorChild,
  AbstractSyntaxTree,
} from "./types.js";

/* 
TODO: outdated
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

const getPrecedence = (token: TokenGroupSeparatorChild, scope: Scope) =>
  (token.type === "operator" && scope[token.id].precedence) || [null, null];

export const parseTokensToAST = (
  src: TokenGroupSeparatorChild[],
  i: number,
  precedence: number,
  scope: Scope
): ParsingResult<FlatSyntaxTree> => {
  // no prefix/none-fix operators
  const reducedScope = Iterator.iterEntries(scope)
    .filter(([_, operatorDefinition]) => operatorDefinition.precedence[0] !== null)
    .map<[string, TokenGroupDefinition]>(([id, def]) => [
      id,
      { ...def, separators: def.separators.map((sep) => ({ scope: () => scope, ...sep })) },
    ])
    .toObject();
  let index = i;
  const errors: ParsingError[] = [];
  let lhs: FlatSyntaxTree;

  //skip possible whitespace prefix
  {
    const token = src[index];
    if (token && token.type === "newline") {
      index++;
    }
  }

  if (!src[index]) throw new Error("no tokens");

  {
    // no postfix/infix operators
    const reducedScope = Iterator.iterEntries(scope)
      .filter(([_, operatorDefinition]) => operatorDefinition.precedence[0] === null)
      .map<[string, TokenGroupDefinition]>(([id, def]) => [
        id,
        { ...def, separators: def.separators.map((sep) => ({ scope: () => scope, ...sep })) },
      ])
      .toObject();
    let [nextIndex, token, errors] = parseTokensToGroupScope(src, index, reducedScope);
    index = nextIndex;
    const [, right] = getPrecedence(token, reducedScope);

    if (right !== null) {
      const [nextIndex, rhs, _errors] = parseTokensToAST(src, index, right, scope);

      index = nextIndex;
      errors.push(..._errors);
      lhs = { item: token, rhs };
    } else {
      lhs = { item: token };
    }
  }

  while (src[index]) {
    //skip possible whitespace prefix
    {
      const token = src[index];
      if (token && token.type === "newline") {
        index++;
      }
    }

    if (!src[index]) break;

    const [nextIndex, token, _errors] = parseTokensToGroupScope(src, index, reducedScope);
    errors.push(..._errors);
    const [left, right] = getPrecedence(token, reducedScope);
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
  src: TokenGroupSeparatorChild[],
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

export const parseStringToAST = (src: string, i: number, scope: Scope): ConsumeParsingResult<FlatSyntaxTree[]> => {
  const [children, errors] = parseTokens(src, i);
  const [ast, _errors] = parseTokensToASTs(children, 0, scope);

  return [ast, [...errors, ..._errors]];
};

export const stringifyFST = (item: FlatSyntaxTree): string => {
  // item.
  if (item.type === "operator" && item.children.length > 0)
    return `${item.id} ${item.children
      .map((child) => `(${child.children.map(stringifyAST).join(" ")}):${child.separatorIndex}`)
      .join(" ")}`;
  if (item.type === "operator") return `${item.token.src}`;
  return stringifyToken(item);
};
export const stringifyFSTList = (list: FlatSyntaxTree[]): string => list.map(stringifyFST).join("; ");

export const stringifyASTItem = (item: AbstractSyntaxTree["item"]): string => {
  if (item.type === "operator" && item.children.length > 0)
    return `${item.id} ${item.children
      .map((child) => `(${child.children.map(stringifyAST).join(" ")}):${child.separatorIndex}`)
      .join(" ")}`;
  if (item.type === "operator") return `${item.token.src}`;
  return stringifyToken(item);
};

export const stringifyAST = (ast: AbstractSyntaxTree): string => {
  let result = stringifyASTItem(ast.item);
  if (ast.lhs) result = `${result} (${stringifyAST(ast.lhs)})`;
  if (ast.rhs) result = `${result} (${stringifyAST(ast.rhs)})`;
  return result;
};

export const stringifyASTList = (list: AbstractSyntaxTree[]): string => list.map(stringifyAST).join("; ");
