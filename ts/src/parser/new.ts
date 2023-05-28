import { Iterator } from "../utils.js";

type Token = string;

export type ScopeGenerator = (enclosing: Scope) => Scope;
type SeparatorDefinition = {
  tokens: Token[];
  repeats: [min: number, max: number];
  scope?: ScopeGenerator;
};
export type OperatorDefinition = {
  separators: SeparatorDefinition[];
};
export type Scope = Record<string, OperatorDefinition>;
type OperatorInstance = { token: string; children: SeparatorInstance[] };
type SeparatorInstance = {
  children: (({ id: string } & OperatorInstance) | Token)[];
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
5. if current separator's repeats is equal to max repeats - drop leading separator
6. While list of separators is not empty, do:
  1. Take a leading sublist of separators that has exactly one non-optional separator
  2. Check if current position in string matches one of separators' tokens
  3. If matches:
    1. move cursor past separator's token
    2. if not first separator in list - reset current separator's repeats to 0
    3. remove all preceding separators from list
    4. Add current separator instance to operator's children. 
    5. Increment current separator's repeats
    7. If current separator's repeats is below min repeats - go to 1.2.
    8. if current separator's repeats is equal to max repeats - drop leading separator
    9. go to 1.1
  4. if does not match - try parsing one of operators, use scope generated based on next required separator.
  5. If none of operators are matched\parsed - append current character to the separator's children, then go to 1.2.
  6. if current character is not available - reached end of string, emit error
  7. Otherwise add parsed operator to the separator instance's children
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
  const tokens = operator.separators[0].tokens;
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
  if (separatorRepeats === repeats[1]) separatorList.splice(0, 1);

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
        if (separatorRepeats === repeats[1]) separatorList.splice(0, 1);
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
