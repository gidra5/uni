import { operands } from "./parser/index.mjs";
import { Operator, OperatorDefinition, OperatorType, prefix, Registry , Error, isIdentifier} from "./parser/types.mjs";
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
  
const isExactOperator: (op: string, source: string, _res: [Operator[], Error[]]) => asserts _res is [[OperatorType], []] = (op, source, _res) => {
  const [res, errors] = _res;
  assert(errors.length === 0, source + ' was parsed with errors:\n\t' + errors.join('\n\t'));
  assert(res.length === 1, source + ' has more operators than expected: ' + JSON.stringify(res, null, 2));
  const [operator] = res;
  assert(typeof operator !== 'string', source + ' has string operators: ' + JSON.stringify(res, null, 2));
  assert(operator.type === 'operator', source + ' does not contain operator: ' + JSON.stringify(res, null, 2));
  assert(operator.item === op, source + ' does not contain "if" operator: ' + JSON.stringify(res, null, 2));
}

test({
  operatorParserMixfix: () => {
    const registry = new Registry<OperatorDefinition>({
      parens: {
        separators: [
          { token: { type: "ident", item: "(" } },
          { token: { type: "ident", item: ")" } },
        ],
      },
    });
  
    {
      const source = "(x)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x y z)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2, op3] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 1, source + ' does not contain exactly 1 repeated operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) && isIdentifier(op3), source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y' && op3.item === 'z', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserMixfixOptional: () => {
    const registry = new Registry<OperatorDefinition>({
      parens: {
        separators: [
          { token: { type: "ident", item: "(" } },
          { token: ',', optional: true },
          { token: { type: "ident", item: ")" } },
        ],
      },
    });
  
    {
      const source = "(x)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 2, source + ' does not contain exactly 2 operands: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 0 && _operands[1].length === 1, source + ' does not contain exactly 0, 1 repeated operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x, y)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 2, source + ' does not contain exactly 2 repeated operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserMixfixOptionalLeading: () => {
    const registry = new Registry<OperatorDefinition>({
      block: {
        separators: [
          { token: { type: "ident", item: "with" }, optional: true },
          { token: { type: "ident", item: "{" } },
          { token: { type: "ident", item: "}" } },
        ],
      },
    });
  
    {
      const source = "{ x }";
      const res = transpose(operands(registry)(source));
      isExactOperator('block', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "with x { y }";
      const res = transpose(operands(registry)(source));
      isExactOperator('block', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2] = _operands.flat(3);
      assert(_operands.length === 2, source + ' does not contain exactly 2 operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserMixfixOptionalTrailing: () => {
    const registry = new Registry<OperatorDefinition>({
      if: {
        separators: [
          { token: { type: "ident", item: "if" } },
          { token: ":" },
          { token: { type: "ident", item: "else" }, optional: true },
        ],
      },
    });
  
    {
      const source = "if x: y else";
      const res = transpose(operands(registry)(source));
      isExactOperator('if', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2] = _operands.flat(3);
      assert(_operands.length === 2, source + ' does not contain exactly 2 operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2), source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y', source + ' operands are not identifiers x and y: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "if x:";
      const res = transpose(operands(registry)(source));
      isExactOperator('if', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserMixfixRepeatOptional: () => {
    const registry = new Registry<OperatorDefinition>({
      parens: {
        separators: [
          { token: { type: "ident", item: "(" } },
          { token: ',', repeat: true, optional: true },
          { token: { type: "ident", item: ")" } },
        ],
      },
    });
  
    {
      const source = "(x)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 2, source + ' does not contain exactly 2 operands: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 0 && _operands[1].length === 1, source + ' does not contain exactly 0, 1 repeated operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x, y)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 2, source + ' does not contain exactly 2 repeated operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x, y, z)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2, op3] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 3, source + ' does not contain exactly 3 repeated operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) && isIdentifier(op3), source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y' && op3.item === 'z', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserMixfixRepeat: () => {
    const registry = new Registry<OperatorDefinition>({
      parens: {
        separators: [
          { token: { type: "ident", item: "(" } },
          { token: ',', repeat: true },
          { token: { type: "ident", item: ")" } },
        ],
      },
    });
  
    {
      const source = "(x,)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x, y)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 2, source + ' does not contain exactly 2 repeated operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "(x, y, z)";
      const res = transpose(operands(registry)(source));
      isExactOperator('parens', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1, op2, op3] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(_operands[0].length === 3, source + ' does not contain exactly 3 repeated operands: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) && isIdentifier(op2) && isIdentifier(op3), source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x' && op2.item === 'y' && op3.item === 'z', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
  operatorParserSimilarOperators: () => {
    const registry = new Registry<OperatorDefinition>({
      if: {
        separators: [
          { token: { type: "ident", item: "if" } },
          { token: ":" },
        ],
      },
      ifThen: {
        separators: [
          { token: { type: "ident", item: "if" } },
          { token: { type: "ident", item: "then" } },
        ],
      },
    });
  
    {
      const source = "if x:";
      const res = transpose(operands(registry)(source));
      isExactOperator('if', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  
    {
      const source = "if x then";
      const res = transpose(operands(registry)(source));
      isExactOperator('ifThen', source, res);
      const [operator] = res[0];
  
      const { operands: _operands } = operator;
      const [op1] = _operands.flat(3);
      assert(_operands.length === 1, source + ' does not contain exactly 1 operand: ' + JSON.stringify(res, null, 2));
      assert(isIdentifier(op1) , source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
      assert(op1.item === 'x', source + ' operands are not identifiers: ' + JSON.stringify(res, null, 2));
    }
  },
});
