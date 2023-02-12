import { operands } from "./parser/index.mjs";
import { Operator, OperatorDefinition, OperatorType, prefix, Registry, Error, isIdentifier } from "./parser/types.mjs";
import { transpose } from "./parser/utils.mjs";
import { assert } from "./utils.mjs";

const test = (testCases: { [name in string]: () => void }) => {
  for (const testCaseName in testCases) {
    const testCase = testCases[testCaseName];
    try {
      testCase();
    } catch (e: any) {
      console.error(`Test case ${testCaseName} failed: ${e.message}`);
    }
  }
};

const isExactOperator: (
  op: string,
  source: string,
  _res: [Operator[], Error[]]
) => asserts _res is [[OperatorType], []] = (op, source, _res) => {
  const [res, errors] = _res;
  assert(errors.length === 0, source + " was parsed with errors:\n\t" + errors.join("\n\t"));
  assert(res.length === 1, source + " has more operators than expected: " + JSON.stringify(res, null, 2));
  const [operator] = res;
  assert(typeof operator !== "string", source + " has string operators: " + JSON.stringify(res, null, 2));
  assert(operator.type === "operator", source + " does not contain operator: " + JSON.stringify(res, null, 2));
  assert(operator.item === op, source + ' does not contain "if" operator: ' + JSON.stringify(res, null, 2));
};
const registry = new Registry<OperatorDefinition>({
  op1: {
    separators: [
      { token: { type: "ident", item: "_1" } },
      { token: { type: "ident", item: "_2", repeat: [0, null] } },
      { token: { type: "ident", item: "_3", repeat: [0, 1] } },
      { token: { type: "ident", item: "_4", repeat: [1, null] } },
    ],
    precedence: [null, null],
  },
  op2: {
    separators: [
      { token: { type: "ident", item: "_5" } },
      { token: { type: "ident", item: "_6", repeat: [0, null] } },
      { token: { type: "ident", item: "_7", repeat: [0, 1] } },
      { token: { type: "ident", item: "_8", repeat: [1, null] } },
    ],
    precedence: [1, null],
  },
  op3: {
    separators: [
      { token: { type: "ident", item: "_9" } },
      { token: { type: "ident", item: "_10", repeat: [0, null] } },
      { token: { type: "ident", item: "_11", repeat: [0, 1] } },
      { token: { type: "ident", item: "_12", repeat: [1, null] } },
    ],
    precedence: [null, 2],
  },
  op4: {
    separators: [
      { token: { type: "ident", item: "_13" } },
      { token: { type: "ident", item: "_14", repeat: [0, null] } },
      { token: { type: "ident", item: "_15", repeat: [0, 1] } },
      { token: { type: "ident", item: "_16", repeat: [1, null] } },
    ],
    precedence: [2, 3],
  },
  op5: {
    separators: [
      { token: { type: "ident", item: "_17" } },
      { token: { type: "ident", item: "_18", repeat: [0, null] } },
      { token: { type: "ident", item: "_19", repeat: [0, 1] } },
      { token: { type: "ident", item: "_20", repeat: [1, null] } },
    ],
    precedence: [5, 4],
  },
});

test({
  operatorParser1: () => {
    const source = "_1";
    const res = transpose(operands(registry)(source));
    isExactOperator("parens", source, res);
    const [operator] = res[0];

    const { operands: _operands } = operator;
    const [op1] = _operands.flat(3);
    assert(_operands.length === 2, source + " does not contain exactly 2 operands: " + JSON.stringify(res, null, 2));
    assert(
      _operands[0].length === 0 && _operands[1].length === 1,
      source + " does not contain exactly 0, 1 repeated operand: " + JSON.stringify(res, null, 2)
    );
    assert(isIdentifier(op1), source + " operands are not identifiers: " + JSON.stringify(res, null, 2));
    assert(op1.item === "x", source + " operands are not identifiers: " + JSON.stringify(res, null, 2));
  },
});
