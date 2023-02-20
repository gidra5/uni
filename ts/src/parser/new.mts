import { enumerate, iter, repeat } from "../utils.mjs";

type SeparatorDef = {
  tokens: string[];
  repeat: [from: number, to: number];
};
type OperatorDef = {
  separators: SeparatorDef[];
  scope: (enclosing: OperatorDefs) => OperatorDefs;
};
type OperatorDefs = Record<string, OperatorDef>;
type OperatorsValue = { id: string } & OperatorValue;
type OperatorValue = {
  separatorValues: SeparatorValue[];
};
type SeparatorValue = {
  operands: (OperatorsValue | string)[];
}[];

const parseNext = (src: string, i: number, token: string) => {
  if (src.slice(i, token.length) === token) return i + token.length;
  return i;
};

const parseUntil = (
  src: string,
  i: number,
  _tokens: string[][],
  parse: (src: string, i: number) => number
) => {
  let index = i;

  while (src.charAt(index)) {
    for (const [tokens, i] of enumerate(iter(_tokens))) {
      for (const token of tokens) {
        const nextIndex = parseNext(src, index, token);
        if (nextIndex !== index) {
          return [nextIndex, i] as const;
        }
      }
    }
    index = parse(src, index);
  }
  return [i, null] as const;
};

const terminalTokens = (operator: SeparatorDef[]) => {
  const tokens: string[][] = [];

  for (const sep of operator) {
    tokens.push(sep.tokens);
    if (sep.repeat[0] > 0) return tokens;
  }
  return tokens;
};

const parseOperator = (
  scope: OperatorDefs,
  operator: OperatorDef,
  src: string,
  i: number
) => {
  let index = i;
  let values: OperatorValue = { separatorValues: [] };
  let { separators } = operator;

  while (src.charAt(index)) {
    const sepValues: SeparatorValue = [];
    const sepValue: SeparatorValue[number] = { operands: [] };
    let [_i, sepIndex] = parseUntil(
      src,
      index,
      terminalTokens(separators),
      (src, i) => {
        const operators = operator.scope?.(scope) ?? scope;
        const [index, value] = parseOperators(operators, src, i);
        if (value) {
          sepValue.operands.push(value);
          return index;
        }
        sepValue.operands.push(src[i]);
        return i + 1;
      }
    );

    const optional = separators.every(({ repeat }) => repeat[0] === 0);
    if (!sepIndex && !optional) return [i, null] as const;
    else sepIndex = separators.length - 1;

    index = _i;

    values.separatorValues.push(sepValues);
    if (sepIndex > 0) values.separatorValues.push(...repeat([], sepIndex));
    separators = separators.slice(sepIndex + 1);
  }
  return [index, values] as const;
};

const parseOperators = (operators: OperatorDefs, src: string, i: number) => {
  for (const operator in operators) {
    const [index, value] = parseOperator(
      operators,
      operators[operator],
      src,
      i
    );
    if (value) return [index, { ...value, id: operator }] as const;
  }
  return [i, null] as const;
};
