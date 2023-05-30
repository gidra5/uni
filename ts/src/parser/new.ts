import { Iterator } from "../utils.js";

export type ScopeGenerator = (enclosing: Scope) => Scope;
export type SeparatorDefinition = {
  tokens: string[];
  repeats: [min: number, max: number];
  scope?: ScopeGenerator;
};
export type OperatorDefinition = {
  separators: SeparatorDefinition[];
};
export type Scope = Record<string, OperatorDefinition>;

export type Token =
  | { type: "identifier" | "whitespace" | "newline"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string; value: string };
export type OperatorInstance = { token: Token; children: SeparatorInstance[] };
export type SeparatorChildren = (({ id: string } & OperatorInstance) | Token)[];
export type SeparatorInstance = {
  children: SeparatorChildren;
  separatorIndex: number;
  separatorToken: Token;
};

type ParsingError = { message: string };
type ParsingResult<T> = [index: number, result: T, errors: ParsingError[]];
// type Parser<T> = (src: string, i: number) => ParsingResult<T>;

/* 
"Operator" Parsing algorithm:

Input: 
1. source string to be parsed
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

export const parseOperator = (
  src: string,
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

  const [{ tokens }] = separatorList[0];
  const token = tokens.find((token) => src.startsWith(token, index));

  if (!token) {
    return [
      index,
      { token: "", children: [] },
      [{ message: "Does not match leading token" }],
    ];
  }

  index += token.length;
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
        .filter(([_, token]) => src.startsWith(token, index));

      if (matchedSeparator) {
        const [matchedIndex, separatorToken] = matchedSeparator;
        const [{ repeats }, separatorIndex] = separatorList[matchedIndex];

        index += separatorToken.length;
        if (matchedIndex !== 0) separatorRepeats = 0;
        separatorList.splice(0, matchedIndex);
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
            const [nextIndex, operator, errors] = parseOperator(
              src,
              index,
              operatorDefinition,
              scopeGen(scope)
            );
            if (errors.length > 0) return { pred: false };
            else {
              return {
                pred: true,
                value: [nextIndex, { ...operator, id }] as const,
              };
            }
          }
        );

        if (!matchedToken) {
          if (!src.charAt(index)) {
            const [head, ...rest] = separatorList;
            if (
              head[0].repeats[0] <= separatorRepeats &&
              rest.every(([{ repeats }]) => repeats[0] === 0)
            )
              return [index, { token, children }, errors];
            return [
              index,
              { token: "", children: [] },
              [{ message: "Reached end of source" }],
            ];
          }

          const top = separatorChildren[separatorChildren.length - 1];
          if (typeof top === "string") {
            separatorChildren[separatorChildren.length - 1] =
              top + src.charAt(index);
          } else separatorChildren.push(src.charAt(index));
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
1.
*/

export const parseToken = (src: string, i: number): ParsingResult<Token> => {
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
      {
        type: "number",
        src: src.substring(start, index),
        value: Number(value),
      },
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

  if (/[^_\w\s\d"]/.test(src.charAt(index))) {
    const start = index;
    while (/[^_\w\s\d"]/.test(src.charAt(index))) index++;

    return [
      index,
      { type: "identifier", src: src.substring(start, index) },
      errors,
    ];
  }

  errors.push({ message: "unexpected character" });
  return [index, { type: "whitespace", src: "" }, errors];
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
1.
*/
const prattParser = (
  src: string,
  i: number,
  precedence: number,
  scope: Scope
) => {
  // ExprNode left = switch (it.peek().type()) {
  //   case Identifier -> {
  //     var tokenNode = it.next();
  //     yield switch (it.peek().type()) {
  //       case Sub, Add, Mult, Div, Pow, Mod, Factorial, RParenthesis, EOT -> tokenNode;
  //       default -> new FnCallExprNode(tokenNode, ExprNode.parse(it, 6, nodes));
  //     };
  //   }
  //   case Number -> it.next();
  //   case Sub -> new UnaryPrefixExprNode(it.next(), ExprNode.parse(it, 4, nodes));
  //   case LParenthesis -> ExprNode.parseInParenthesis(it, nodes);
  //   case Derivative -> DerivativeExprNode.parse(it, nodes);
  //   default -> throw new FailedToParseException("Not expr");
  // };
  // while (precedence < it.peek().precedence()) {
  //   left = switch (it.peek().type()) {
  //     case Sub, Add, Mult, Div, Pow, Mod -> BinaryInfixExprNode.parse(it, left, nodes);
  //     case Factorial -> new UnaryPostfixExprNode(left, it.next());
  //     default -> left;
  //   };
  // }
  // return left;
};
