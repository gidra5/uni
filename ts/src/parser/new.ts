import { Iterator } from "../utils.js";

type Token = string;

type SeparatorDef = {
  tokens: Token[];
  repeat: [from: number, to: number];
  scope: (enclosing: OperatorDefs) => OperatorDefs;
};
export type OperatorDef = {
  separators: SeparatorDef[];
  scope: (enclosing: OperatorDefs) => OperatorDefs;
};
export type OperatorDefs = Record<string, OperatorDef>;
type OperatorsValue = { id: string } & OperatorValue;
type OperatorValue = { children: SeparatorValue[] };
type SeparatorValue = {
  children: (OperatorsValue | Token)[];
  separatorIndex: number;
  separatorToken: Token;
};

type ParsingError = { message: string };
type ParsingResult<T> = [index: number, result: T, errors: ParsingError[]];
type Parser<T> = (src: string, i: number) => ParsingResult<T>;

const parseNext = (
  src: string,
  i: number,
  token: string
): ParsingResult<boolean> => {
  if (src.slice(i, token.length) === token) return [i + token.length, true, []];
  return [i, false, [{ message: `expected token: "${token}"` }]];
};

const parseUntil = <T>(
  src: string,
  i: number,
  tokens: string[],
  parse: Parser<T>
): ParsingResult<T[]> => {
  let index = i;
  const values: T[] = [];
  const errors: ParsingError[] = [];

  while (src.charAt(index)) {
    for (const token of tokens) {
      const [_, isNext] = parseNext(src, index, token);
      if (isNext) return [index, values, errors];
    }
    const [nextIndex, result, _errors] = parse(src, index);
    index = nextIndex;
    values.push(result);
    errors.push(..._errors);
  }
  return [index, values, errors];
};

const parseUntilEnd = <T>(
  src: string,
  i: number,
  parse: Parser<T>
): ParsingResult<T[] | null> => {
  let index = i;
  const parsed: T[] = [];
  const errors: ParsingError[] = [];

  while (src.charAt(index)) {
    const [nextIndex, result, _errors] = parse(src, index);
    index = nextIndex;
    parsed.push(result);
    errors.push(..._errors);
  }
  return [index, parsed, errors];
};

const parseOneOf = <T>(
  src: string,
  i: number,
  parsers: Record<string, Parser<T>>
): ParsingResult<[id: string, value: T] | null> => {
  const errors: ParsingError[] = [];
  for (const parserId in parsers) {
    const [index, value, _errors] = parsers[parserId](src, i);
    if (_errors.length === 0) return [index, [parserId, value], []];
    else
      errors.push(
        ..._errors.map(({ message }) => ({
          message: `Error while trying option "${parserId}": ${message}`,
        }))
      );
  }
  return [i, null, errors];
};

const terminalTokens = (operator: SeparatorDef[]) => {
  const tokens: string[][] = [];

  for (const sep of operator) {
    tokens.push(sep.tokens);
    if (sep.repeat[0] > 0) return tokens;
  }

  return tokens;
};

// const parseSeparator = (
//   src: string,
//   i: number,
//   operator: SeparatorDef,
//   scope: OperatorDefs
// ): ParsingResult<SeparatorValue> => {
//   let { tokens, repeat } = operator;

//   return [index, { separatorValues }] as const;
// };

export const parseOperator = (
  src: string,
  i: number,
  operator: OperatorDef,
  scope: OperatorDefs
): ParsingResult<OperatorValue> => {
  let index = i;
  let { separators } = operator;
  const separatorValues: SeparatorValue[] = [];
  const errors: ParsingError[] = [];

  for (const [separator, i] of Iterator.iter(separators).enumerate()) {
    const _scope = separator.scope(scope);
    const parsers = Object.fromEntries(
      Object.entries(_scope).map(([id, op]) => [
        id,
        (src: string, i: number) => parseOperator(src, i, op, _scope),
      ])
    );
    const [nextIndex, value, _errors] = parseUntil<OperatorsValue | string>(
      src,
      index,
      separator.tokens,
      (src, i) => {
        const [nextIndex, value, errors] = parseOneOf(src, i, parsers);
        if (!value) return [i + 1, src.charAt(i), []];
        const [id, operatorValue] = value;
        return [nextIndex, { id, ...operatorValue }, errors];
      }
    );

    if (!src.charAt(nextIndex)) {
      if (separator.repeat[0] === 0) {
      }
    } else {
      index = nextIndex;
      separatorValues.push({
        children: value,
        separatorIndex: i,
        separatorToken: separator.tokens.find((token) =>
          src.slice(index).startsWith(token)
        ) as string,
      });
      errors.push(
        ..._errors.map(({ message }) => ({
          message: `Error while parsing separator "${separator}", ${separatorValues.length} repeat: ${message}`,
        }))
      );
    }
  }

  return [index, { children: separatorValues }, errors];
};

/* 
"Operator" Parsing algorithm:

Input: 
1. string to be parsed
2. iterator over characters (for example integer index into string)
3. list of possible "operators"
4. "operator"'s definition to be parsed, which includes:
  4.1. sequence of "separators", which include:
    4.1.1. list of separator's definition tokens
    4.1.2. number of repeats allowed for that separator


Output:
1. Final index after parsing the whole "operator"
2. parsed "operator", that is a sequence of "separator instances", where "separator instance" includes:
  2.1. sequence of chidren (nested operators and characters before respective separator)
  2.2. separator's index in definition
  2.2. separator's token
3. List of errors that occured during parsing

Instructions: 

1. Take next separator from definition
2. Check if current position in string matches one of separator's tokens
3. If matches:
  3.1. Add current sequence of children of separator's instance, 
  separator's token and separator's index to operator's children. 
  3.2. Increment current separator's repeats
  3.2. Check if current separator's repeats is below min count
  3.3. If true - move cursor past separator's token then go to 2.
  3.4. Check if current separator's repeats is equal to max count
  3.5. If true - go to 1
4. if does not match - try parsing one of possible operators
5. If none of operators are successfully parsed - add current character to the children
6. Otherwise add successfully parsed operator to the children

*/
