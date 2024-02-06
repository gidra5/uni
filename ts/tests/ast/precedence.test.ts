import { infixArithmeticOps, prefixArithmeticOps } from "../../src/parser/constants";
import { describe } from "vitest";
import { test } from "@fast-check/vitest";
import { treeTestCase } from "./utils";

describe("arithmetics", () => {
  const infixOpPairs = infixArithmeticOps.power(2);

  for (const [[op1Name, op1], [op2Name, op2]] of infixOpPairs) {
    if (op1Name === op2Name) {
      test(`${op1Name} association`, () => {
        const src = `123 ${op1} 456 ${op2} 789`;
        treeTestCase(src);
      });
      continue;
    }
    test(`${op1Name} ${op2Name}`, () => {
      const src = `123 ${op1} 456 ${op2} 789`;
      treeTestCase(src);
    });
    for (const [op3Name, op3] of prefixArithmeticOps) {
      test(`${op1Name} ${op3Name} ${op2Name}`, () => {
        const src = `123 ${op1} ${op3}456 ${op2} 789`;
        treeTestCase(src);
      });
      test(`${op1Name} ${op3Name} application ${op2Name}`, () => {
        const src = `123 ${op1} ${op3}a 456 ${op2} 789`;
        treeTestCase(src);
      });
    }
  }
});
