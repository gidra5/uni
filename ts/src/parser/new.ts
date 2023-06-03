import { Iterator, assert } from "../utils.js";

export type ScopeGenerator = (enclosing: Scope) => Scope;
export type SeparatorDefinition = {
  tokens: string[];
  repeats: [min: number, max: number];
  scope?: ScopeGenerator;
};
export type Precedence = [prefix: number | null, postfix: number | null];
export type OperatorDefinition = {
  separators: SeparatorDefinition[];
  precedence: Precedence;
};
export type Scope = Record<string, OperatorDefinition>;

export type Token =
  | { type: "identifier" | "whitespace" | "newline"; src: string }
  | { type: "number"; src: string }
  | { type: "string"; src: string; value: string };
export type OperatorInstance = { token: Token; children: SeparatorInstance[] };
export type SeparatorChildren = (
  | ({ id: string; type: "operator" } & OperatorInstance)
  | Token
)[];
export type SeparatorInstance = {
  children: SeparatorChildren;
  separatorIndex: number;
  separatorToken: Token;
};
export type SyntaxTree = {
  item: SeparatorChildren[number];
  lhs?: SyntaxTree;
  rhs?: SyntaxTree;
};

type ParsingError = { message: string };
type ParsingResult<T> = [index: number, result: T, errors: ParsingError[]];
type Parser<T> = (src: string, i: number) => ParsingResult<T>;

/* 
"Operator" Parsing algorithm:

Input: 
1. source tokens to be parsed
2. starting index in source
3. "operator"'s definition to be parsed, which includes:
  1. sequence of "separators", which include:
    1. list of separator's definition tokens
    2. number of repeats allowed for that separator
    3. optional "scope" generator, that accepts enclosing scope 
       and returns new scope to use while parsing its children, identity by default. Only used if min repeats > 0
4. scope of "operator", that is being parsed - dictionary of possible "operators"


Output:
1. Final index after parsing the whole "operator"
2. parsed "operator", that is a sequence of "separator instances", where "separator instance" includes:
  1. sequence of children (nested operators and characters before respective separator)
  2. separator's index in definition
  2. separator's token
3. List of errors that occured during parsing

Instructions: 

1. Match leading separator.
2. if no match - return error
3. update cursor
4. Increment current separator's repeats
5. if current separator's repeats is equal to max repeats - drop leading separator, reset current separator's repeats to 0
6. While list of separators is not empty, do:
  1. Take a leading sublist of separators that has exactly one non-optional separator
  2. Check if current position in string matches one of separators' tokens
  3. If matches:
    1. move cursor past separator's token
    2. if not first separator in list - reset current separator's repeats
    3. remove all preceding separators from list
    4. Add current separator instance to operator's children. 
    5. Increment current separator's repeats
    7. If current separator's repeats is below min repeats - go to 1.2.
    8. if current separator's repeats is equal to max repeats - drop leading separator, reset current separator's repeats
    9. go to 1.1
  4. if does not match - try parsing one of operators, use scope generated based on next required separator.
  5. If none of operators are matched\parsed - append current character to the separator's children, then go to 1.2.
  6. if current character is not available and some separators are required - reached end of string, emit error
  7. if current character is not available and all separators are not required - return resulting operator
  8. Otherwise add parsed operator to the separator instance's children
7. return resulting operator
*/

export const getLeadingSeparators = (
  separators: [item: SeparatorDefinition, i: number][]
) => {
  const list: [item: SeparatorDefinition, i: number][] = [];

  for (const sep of separators) {
    list.push(sep);
    const [{ repeats }] = sep;
    const [min] = repeats;
    if (min > 0) return list;
  }
  return list;
};

const identity = <T>(x: T) => x;

export const parseTokensToOperator = (
  src: Token[],
  i: number,
  operator: OperatorDefinition,
  scope: Scope
): ParsingResult<OperatorInstance> => {
  let index = i;
  const separatorList = Iterator.iter(operator.separators)
    .enumerate()
    .toArray();
  let separatorRepeats = 0;
  const children: SeparatorInstance[] = [];
  const errors: ParsingError[] = [];
  const matchToken = (sourceToken: Token) => (token: string) =>
    (sourceToken.type === "whitespace" && " " === token) ||
    (sourceToken.type === "newline" && "\n" === token) ||
    (sourceToken.type === "identifier" && sourceToken.src === token);
  const [{ tokens }] = separatorList[0];
  const token = src[index];

  if (!tokens.find(matchToken(token))) {
    return [
      index,
      { token: { type: "whitespace", src: "" }, children: [] },
      [{ message: "Does not match leading token" }],
    ];
  }

  index++;
  separatorRepeats++;

  const [{ repeats }] = separatorList[0];
  if (separatorRepeats === repeats[1]) {
    separatorRepeats = 0;
    separatorList.splice(0, 1);
  }

  while (separatorList.length > 0) {
    const leadingSeparators = getLeadingSeparators(separatorList);
    const separatorChildren: SeparatorInstance["children"] = [];

    while (true) {
      const [matchedSeparator] = Iterator.iter(leadingSeparators)
        .enumerate()
        .flatMap(([[sep], i]) =>
          Iterator.iter(sep.tokens).map(
            (token) => [i, token] as [number, string]
          )
        )
        .filter(([_, token]) => matchToken(src[index])(token));

      if (matchedSeparator) {
        const [matchedIndex] = matchedSeparator;
        const separatorToken = src[index];
        const [{ repeats }, separatorIndex] = separatorList[matchedIndex];

        index++;
        if (matchedIndex !== 0) separatorRepeats = 0;
        separatorList.splice(0, matchedIndex);

        const token = separatorChildren.pop();
        if (token && token.type !== "newline" && token.type !== "whitespace") {
          separatorChildren.push(token);
        }

        children.push({
          separatorIndex,
          separatorToken,
          children: separatorChildren,
        });
        separatorRepeats++;

        if (separatorRepeats < repeats[0]) continue;
        if (separatorRepeats === repeats[1]) {
          separatorRepeats = 0;
          separatorList.splice(0, 1);
        }
        break;
      } else {
        const [matchedToken] = Iterator.iterEntries(scope).filterMap(
          ([id, operatorDefinition]) => {
            const [top] = leadingSeparators[leadingSeparators.length - 1];
            const scopeGen = top.scope ?? identity;
            const [nextIndex, operator, errors] = parseTokensToOperator(
              src,
              index,
              operatorDefinition,
              scopeGen(scope)
            );
            if (errors.length > 0) return { pred: false };
            else {
              return {
                pred: true,
                value: [
                  nextIndex,
                  { ...operator, id, type: "operator" },
                ] as const,
              };
            }
          }
        );

        if (!matchedToken) {
          if (token.type === "newline" || token.type === "whitespace") index++;

          if (!src[index]) {
            const [head, ...rest] = separatorList;
            if (
              head[0].repeats[0] <= separatorRepeats &&
              rest.every(([{ repeats }]) => repeats[0] === 0)
            )
              return [index, { token, children }, errors];
            return [
              index,
              { token: { type: "whitespace", src: "" }, children: [] },
              [{ message: "Reached end of source" }],
            ];
          }

          separatorChildren.push(src[index]);
          index++;
          continue;
        }

        const [nextIndex, operator] = matchedToken;

        index = nextIndex;
        separatorChildren.push(operator);
      }
    }
  }

  return [index, { token, children }, errors];
};

export const parseStringToOperators = (
  src: string,
  i: number,
  scope: Scope
): ParsingResult<SeparatorChildren> => {
  const [index, tokens, errors] = parseTokens(src, i);
  let tokensIndex = 0;
  const children: SeparatorChildren = [];

  while (tokens[tokensIndex]) {
    const [matchedToken] = Iterator.iterEntries(scope).filterMap(
      ([id, operatorDefinition]) => {
        const [nextIndex, operator, errors] = parseTokensToOperator(
          tokens,
          tokensIndex,
          operatorDefinition,
          scope
        );
        if (errors.length > 0) return { pred: false };
        else {
          return {
            pred: true,
            value: [nextIndex, { ...operator, id, type: "operator" }] as const,
          };
        }
      }
    );

    if (!matchedToken) {
      children.push(tokens[tokensIndex]);
      tokensIndex++;
    } else {
      const [nextIndex, instance] = matchedToken;

      tokensIndex = nextIndex;
      children.push(instance);
    }
  }

  return [index, children, errors];
};

/* 
Tokenizer algorithm:

Input: 
1. source string to be parsed
2. starting index


Output:
1. Final index after parsing "token"
2. parsed "token"
3. List of errors that occured during parsing

Instructions: 
1. if current char is `"` - parse string
  1. save current index
  2. increment current index
  3. while current char is not `"` do:
    1. if current char is `\` - increment curr index
    2. if there is no char - emit error, break loop
    3. append current char to string's value
    4. inc curr index
  4. return resulting token
2. if current char is a digit - parse number
  1. save current index
  3. while current char is a digit or `_` do:
    1. if current char is `_` followed by digit - increment curr index
    2. else if it is not followed by digit - break loop
    3. append current char to number's value
    4. inc curr index
  4. if current char is `.` followed by digit then:
    1. append current char to number's value
    2. inc curr index
    3. while current char is a digit or `_` do:
      1. if current char is `_` followed by digit - increment curr index
      2. else if it is not followed by digit - break loop
      3. append current char to number's value
      4. inc curr index
  4. return resulting token
3. if current char is whitespace char then:
  1. save current index
  2. while current char is whitespace char - inc curr index
  3. if token's source includes new line char - return "newline" token
  4. else return "whitespace" token
4. if current char is `_` or a letter then
  1. save current index
  2. while current char is `_` or alphanumeric - inc curr index
  4. return "identifier" token
5. if current char is `.` followed by digit - parse number
  1. save current index
  2. inc current index
  3. set number's value to "0."
  4. while current char is a digit or `_` do:
    1. if current char is `_` followed by digit - increment curr index
    2. else if it is not followed by digit - break loop
    3. append current char to number's value
    4. inc curr index
  4. return resulting token
6. otherwise:
  1. save current index
  2. increment current index
  3. while current char is not any of the above cases - inc curr index
  4. return "identifier" token
*/

export const parseToken: Parser<Token> = (src: string, i: number) => {
  let index = i;
  const errors: ParsingError[] = [];

  if (src.charAt(index) === '"') {
    const start = index;
    index++;

    let value = "";
    while (src.charAt(index) !== '"') {
      if (src.charAt(index) === "\\") index++;
      if (!src.charAt(index)) {
        errors.push({ message: "end of source" });
        break;
      }
      value += src.charAt(index);
      index++;
    }

    return [
      index,
      { type: "string", src: src.substring(start, index), value },
      errors,
    ];
  }

  if (/\d/.test(src.charAt(index))) {
    const start = index;

    let value = "";
    while (/[_\d]/.test(src.charAt(index))) {
      if (src.charAt(index) === "_" && /\d/.test(src.charAt(index + 1))) {
        index++;
      } else if (src.charAt(index) === "_") break;
      value += src.charAt(index);
      index++;
    }
    if (src.charAt(index) === "." && /\d/.test(src.charAt(index + 1))) {
      value += src.charAt(index);
      index++;
      while (/[_\d]/.test(src.charAt(index))) {
        if (src.charAt(index) === "_" && /\d/.test(src.charAt(index + 1))) {
          index++;
        } else if (src.charAt(index) === "_") break;
        value += src.charAt(index);
        index++;
      }
    }

    return [
      index,
      { type: "number", src: src.substring(start, index) },
      errors,
    ];
  }

  if (/\s/.test(src.charAt(index))) {
    const start = index;
    while (/\s/.test(src.charAt(index))) index++;
    const _src = src.substring(start, index);

    return [
      index,
      { type: _src.includes("\n") ? "newline" : "whitespace", src: _src },
      errors,
    ];
  }

  if (/_\w/.test(src.charAt(index))) {
    const start = index;
    while (/[_\w\d]/.test(src.charAt(index))) index++;

    return [
      index,
      { type: "identifier", src: src.substring(start, index) },
      errors,
    ];
  }

  if (src.charAt(index) === "." && /\d/.test(src.charAt(index))) {
    const start = index;
    index++;
    let value = "0.";
    while (/[_\d]/.test(src.charAt(index))) {
      if (src.charAt(index) === "_" && /\d/.test(src.charAt(index + 1))) {
        index++;
      } else if (src.charAt(index) === "_") break;
      value += src.charAt(index);
      index++;
    }

    return [
      index,
      {
        type: "number",
        src: src.substring(start, index),
        value: Number(value),
      },
      errors,
    ];
  }

  const start = index;
  index++;
  while (/[^_\w\s\d."]/.test(src.charAt(index))) index++;

  return [
    index,
    { type: "identifier", src: src.substring(start, index) },
    errors,
  ];
};

export const parseTokens: Parser<Token[]> = (src: string, i: number) => {
  let index = i;
  const errors: ParsingError[] = [];
  const tokens: Token[] = [];

  while (src.charAt(index)) {
    const [nextIndex, token, _errors] = parseToken(src, index);

    index = nextIndex;
    tokens.push(token);
    errors.push(..._errors);
  }

  return [index, tokens, errors];
};

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

export const parseOperatorsToAST = (
  src: SeparatorChildren,
  i: number,
  precedence: number,
  scope: Scope
): ParsingResult<SyntaxTree> => {
  let index = i;
  let token = src[index];
  const errors: ParsingError[] = [];
  let lhs: SyntaxTree;

  //skip possible whitespaces
  if (token.type === "newline" || token.type === "whitespace") {
    index++;
    token = src[index];
  }

  if (!token)
    return [
      index,
      { item: { type: "whitespace", src: "" } },
      [...errors, { message: "end of stream" }],
    ];

  if (
    token.type === "identifier" ||
    token.type === "number" ||
    token.type === "string"
  ) {
    index++;
    lhs = { item: token };
  } else {
    assert(token.type === "operator");
    const { precedence } = scope[token.id];
    const [left, right] = precedence;

    if (left === null && right !== null) {
      const [nextIndex, rhs, _errors] = parseOperatorsToAST(
        src,
        index,
        right,
        scope
      );

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

  while (true) {
    token = src[index];

    if (token.type === "newline" || token.type === "whitespace") {
      index++;
      token = src[index];
    }

    if (!token) break;
    if (token.type !== "operator") {
      return [
        index,
        { item: { type: "whitespace", src: "" } },
        [...errors, { message: "no operator" }],
      ];
    }

    const {
      precedence: [left, right],
    } = scope[token.id];

    if (left === null || left < precedence) break;
    index++;

    if (right === null) {
      lhs = { item: token, lhs };
    } else {
      const [nextIndex, rhs, _errors] = parseOperatorsToAST(
        src,
        index,
        right,
        scope
      );

      index = nextIndex;
      errors.push(..._errors);
      lhs = { item: token, lhs, rhs };
    }
  }
  return [index, lhs, errors];
};

export const parseStringToAST = (
  src: string,
  i: number,
  scope: Scope
): ParsingResult<SyntaxTree[]> => {
  const [index, children, errors] = parseStringToOperators(src, i, scope);
  const ast: SyntaxTree[] = [];
  let childrenIndex = 0;

  while (children[childrenIndex]) {
    const [index, astNode, _errors] = parseOperatorsToAST(
      children,
      childrenIndex,
      0,
      scope
    );

    childrenIndex = index;
    ast.push(astNode);
    errors.push(..._errors);
  }

  return [index, ast, errors];
};
