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

import { Iterator } from "../utils";
import { parseTokens } from "./tokens";
import {
  TokenGroupDefinition,
  TokenGroup,
  ParsingError,
  ParsingResult,
  Scope,
  TokenGroupSeparatorChildren,
  SeparatorDefinition,
  TokenGroupSeparator,
  Token,
} from "./types";

export const getLeadingSeparators = (separators: [item: SeparatorDefinition, i: number][]) => {
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
  operator: TokenGroupDefinition,
  scope: Scope
): ParsingResult<TokenGroup> => {
  let index = i;
  const leadingToken = src[index];
  const separatorList = Iterator.iter(operator.separators).enumerate().toArray();
  let separatorRepeats = 0;
  const children: TokenGroupSeparator[] = [];
  const errors: ParsingError[] = [];
  const matchToken = (sourceToken?: Token) => (token: string) =>
    !!sourceToken &&
    ((sourceToken.type === "whitespace" && " " === token) ||
      (sourceToken.type === "newline" && "\n" === token) ||
      (sourceToken.type === "identifier" && sourceToken.src === token));

  {
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
  }

  while (separatorList.length > 0) {
    const leadingSeparators = getLeadingSeparators(separatorList);
    const separatorChildren: TokenGroupSeparator["children"] = [];

    while (true) {
      if (!src[index]) {
        return [
          index,
          { token: { type: "whitespace", src: "" }, children: [] },
          [{ message: `Can't match separators ${JSON.stringify(leadingSeparators)}, End of tokens` }],
        ];
      }

      const [matchedSeparator] = Iterator.iter(leadingSeparators)
        .enumerate()
        .flatMap(([[sep], i]) => Iterator.iter(sep.tokens).map((token) => [i, token] as [number, string]))
        .filter(([_, token]) => matchToken(src[index])(token));

      if (matchedSeparator) {
        const [matchedIndex] = matchedSeparator;
        const separatorToken = src[index];
        const [{ repeats }, separatorIndex] = separatorList[matchedIndex];

        index++;
        if (matchedIndex !== 0) separatorRepeats = 0;
        separatorList.splice(0, matchedIndex);

        {
          const token = separatorChildren.pop();
          if (token && token.type !== "newline" && token.type !== "whitespace") {
            separatorChildren.push(token);
          }
        }

        {
          const token = separatorChildren.shift();
          if (token && token.type !== "newline" && token.type !== "whitespace") {
            separatorChildren.unshift(token);
          }
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
        const [matchedToken] = Iterator.iterEntries(scope).filterMap(([id, operatorDefinition]) => {
          const [top] = leadingSeparators[leadingSeparators.length - 1];
          const scopeGen = top.scope ?? identity;
          const [nextIndex, operator, errors] = parseTokensToOperator(src, index, operatorDefinition, scopeGen(scope));
          if (errors.length > 0) return { pred: false };
          else {
            return {
              pred: true,
              value: [nextIndex, { ...operator, id, type: "operator" }] as const,
            };
          }
        });

        if (!matchedToken) {
          const token = src[index];

          if (!src[index]) {
            const [head, ...rest] = separatorList;
            if (head[0].repeats[0] <= separatorRepeats && rest.every(([{ repeats }]) => repeats[0] === 0))
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

  return [index, { token: leadingToken, children }, errors];
};

export const parseStringToOperators = (
  src: string,
  i: number,
  scope: Scope
): ParsingResult<TokenGroupSeparatorChildren> => {
  const [index, tokens, errors] = parseTokens(src, i);
  let tokensIndex = 0;
  const children: TokenGroupSeparatorChildren = [];

  while (tokens[tokensIndex]) {
    const [matchedToken] = Iterator.iterEntries(scope).filterMap(([id, operatorDefinition]) => {
      const [nextIndex, operator, errors] = parseTokensToOperator(tokens, tokensIndex, operatorDefinition, scope);
      if (errors.length > 0) return { pred: false };
      else {
        return {
          pred: true,
          value: [nextIndex, { ...operator, id, type: "operator" }] as const,
        };
      }
    });

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
