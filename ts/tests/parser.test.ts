import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { stringifyASTList } from "../src/parser/ast";

describe("parse-stringify", () => {
  const testCase = (src, out, expectedErrors = []) =>
    it(`parses and stringifies "${src}"`, () => {
      const [tree, errors] = parse(src);

      expect(stringifyASTList(tree)).toBe(out);
      expect(errors).toEqual(expectedErrors);
    });
  const binaryOperatorsTestCase = (operators: string[]) => {
    for (const op of operators) testCase(`2 ${op} 3`, op + " (2) (3)");
  };
  binaryOperatorsTestCase(["+", "-", "*", "/", "^"]);
  binaryOperatorsTestCase(["is", "==", "<", "<=", ">", ">="]);
  binaryOperatorsTestCase(["and", "or", "%", ",", "->"]);

  it(`parses and stringifies "2 ; 3"`, () => {
    const [tree, errors] = parse("2 ; 3");

    expect(stringifyASTList(tree)).toBe("; (2); 3");
    expect(errors).toEqual([]);
  });
  // it.only(`parses and stringifies "${`2 ${";"} 3`}"`, () => {
  //   const [tree, errors] = parse(`1 == 2 and x`);
  //   console.dir(tree, { depth: null });

  //   expect(stringifyASTList(tree)).toBe("and (== (1) (2)) (x)");
  //   expect(errors).toEqual([]);
  // });

  testCase('1 == "a" and x < 4 + 5 * 6 ^ 7', 'and (== (1) ("a")) (< (x) (+ (4) (* (5) (^ (6) (7)))))');
  testCase('1 == "a" and x < (4 + 5) * 6 ^ 7', 'and (== (1) ("a")) (< (x) (* (group (+ (4) (5)):1) (^ (6) (7))))');
  testCase("if x: { a; b; c; d }", "if (x):1 (block (sequence (b):0 (c):0 (a) d):1)");
  testCase("-1", "- (1)");
  testCase("not 1", "not (1)");
  testCase("sqrt 1", "sqrt (1)");
  testCase("x is not 1", "is (x) (not (1))");
  testCase("1 <= 2 and 3 <= 4", "and (<= (1) (2)) (<= (3) (4))");
  testCase(" 1 + 2 ", "+ (1) (2)");
});
