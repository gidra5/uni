/* 
TODO: outdated
Group Parsing algorithm:

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
3. List of errors that occurred during parsing

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

import { Iterator, assert } from "../utils";
import { parseTokens } from "./tokens";
import {
  TokenGroupDefinition,
  TokenGroup,
  ParsingError,
  ParsingResult,
  Scope,
  SeparatorDefinition,
  TokenGroupSeparator,
  Token,
  ConsumeParsingResult,
  TokenGroupSeparatorChild,
} from "./types";

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
const matchingToken = (token: string): Token =>
  "\n" === token
    ? { type: "newline", src: token }
    : { type: "identifier", src: token };
const matchToken =
  (sourceToken?: TokenGroupSeparatorChild) => (token: string) =>
    !!sourceToken &&
    ((sourceToken.type === "newline" && "\n" === token) ||
      (sourceToken.type === "identifier" && sourceToken.src === token));
const matchTokens = (
  sourceToken: TokenGroupSeparatorChild,
  tokens: string[]
): sourceToken is Token => tokens.some(matchToken(sourceToken));

// todo: fill children with empty arrays to match separators
const matchingSeparators = (
  separators: [item: SeparatorDefinition, i: number][]
) =>
  Iterator.iter(separators).flatMap<TokenGroupSeparator>(
    ([
      {
        repeats: [count],
        tokens: [token],
      },
      separatorIndex,
    ]) =>
      Iterator.repeat({
        separatorIndex,
        separatorToken: matchingToken(token),
        children: [],
      }).take(count)
  );

const trimNewline = (tokens: TokenGroupSeparatorChild[]) => {
  return tokens.filter((token, i) => {
    if (i !== 0 || i !== tokens.length - 1) return true;
    return token && token.type !== "newline";
  });
};

// synchronized
export const parseTokensToGroup = (
  src: TokenGroupSeparatorChild[],
  i: number,
  groupDefinition: TokenGroupDefinition,
  scope: Scope
): ParsingResult<TokenGroup> => {
  let index = i;
  const leadingToken = src[index++];
  assert(
    matchTokens(leadingToken, groupDefinition.leadingTokens),
    "Does not match leading token"
  );

  const separatorList = Iterator.iter(groupDefinition.separators)
    .enumerate()
    .toArray();
  let separatorRepeats = 0;
  const children: TokenGroupSeparator[] = [];
  const errors: ParsingError[] = [];

  let lastSeparatorIndex = index;
  while (separatorList.length > 0) {
    const leadingSeparators = getLeadingSeparators(separatorList);
    const separatorChildren: TokenGroupSeparator["children"] = [];

    while (true) {
      if (!src[index]) {
        // reset index
        index = lastSeparatorIndex;
        if (
          separatorRepeats >= leadingSeparators[0][0].repeats[0] ||
          leadingSeparators.length > 1
        ) {
          separatorRepeats = 0;
          separatorList.splice(0, 1);
          break;
        }

        // sync
        // fill children up to head separator
        const separatorListHeadItem = separatorList[0];
        const separatorListHeadDefinition = separatorListHeadItem[0];
        const separatorDefinition: SeparatorDefinition = {
          ...separatorListHeadDefinition,
          repeats: [
            separatorListHeadDefinition.repeats[0] - separatorRepeats,
            separatorListHeadDefinition.repeats[1],
          ],
        };
        const { tokens } = separatorListHeadDefinition;

        if (separatorListHeadDefinition.insertIfMissing) {
          // pretend that we matched head separator enough times already
          separatorList.splice(0, 1);
          separatorRepeats = 0;
          children.push(
            ...matchingSeparators([
              [separatorDefinition, separatorListHeadItem[1]],
            ])
          );
          errors.push({
            message: `Missing one of separators: ${tokens.join(", ")}`,
          });
          break;
        }

        // do not try to sync with next separator - just fill children and return current state
        children.push(...matchingSeparators(separatorList));
        errors.push({
          message: `Missing one of separators: ${tokens.join(", ")}`,
        });
        return [index, { token: leadingToken, children }, errors];
      }

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
        const separatorToken = src[index] as Token;
        const [{ repeats }, separatorIndex] = separatorList[matchedIndex];

        index++;
        lastSeparatorIndex = index;
        if (matchedIndex !== 0) {
          separatorRepeats = 0;
          separatorList.splice(0, matchedIndex);
          index = lastSeparatorIndex;
          break;
        }

        children.push({
          separatorIndex,
          separatorToken,
          children: trimNewline(separatorChildren),
        });
        separatorRepeats++;

        if (separatorRepeats < repeats[0]) continue;
        if (separatorRepeats === repeats[1]) {
          separatorRepeats = 0;
          separatorList.splice(0, 1);
        }
        break;
      } else {
        const [leading] = leadingSeparators[0];
        const _scope = (leading.scope ?? identity)(scope);

        // synchronized
        const [nextIndex, matchedToken, _errors] = (
          leading.parse ?? parseTokensToGroupScope
        )(src, index, _scope);
        index = nextIndex;
        errors.push(..._errors);

        separatorChildren.push(matchedToken);
      }
    }
  }

  return [index, { token: leadingToken, children }, errors];
};

type RetType = ParsingResult<TokenGroupSeparatorChild>;

// synchronized
export const parseTokensToGroupScope = (
  src: TokenGroupSeparatorChild[],
  i: number,
  scope: Scope
): RetType => {
  const [entry] = Iterator.iterEntries(scope).filter(([, groupDefinition]) =>
    matchTokens(src[i], groupDefinition.leadingTokens)
  );

  if (!entry) return [i + 1, src[i], []];
  const [id, groupDefinition] = entry;
  const [nextIndex, operator, _errors] = parseTokensToGroup(
    src,
    i,
    groupDefinition,
    scope
  );
  const errors =
    _errors.length === 0
      ? [
          {
            message: `Encountered errors when parsing grouping "${id}"`,
            cause: _errors,
          },
        ]
      : [];
  return [nextIndex, { ...operator, id, type: "operator" }, errors];
};

export const parseTokensToGroups = (
  src: Token[],
  i: number,
  scope: Scope
): ConsumeParsingResult<TokenGroupSeparatorChild[]> => {
  let index = i;
  const children: TokenGroupSeparatorChild[] = [];
  const errors: ParsingError[] = [];

  while (src[index]) {
    const [nextIndex, matchedToken, _errors] = parseTokensToGroupScope(
      src,
      index,
      scope
    );
    index = nextIndex;
    errors.push(..._errors);

    // do not make decision what operator it is if it has no children
    if (matchedToken.type === "operator" && matchedToken.children.length === 0)
      children.push(matchedToken.token);
    else children.push(matchedToken);
  }

  return [children, errors];
};

export const parseStringToGroups = (
  src: string,
  i: number,
  scope: Scope
): ConsumeParsingResult<TokenGroupSeparatorChild[]> => {
  const [tokens, errors] = parseTokens(src, i);
  const [children, _errors] = parseTokensToGroups(tokens, 0, scope);

  return [children, [...errors, ..._errors]];
};
