import { beforeEach, describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { Tree } from "../src/ast";
import { parseScript } from "../src/parser/parser";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { inject, Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { Context, infer, inferTypes, substituteConstraints } from "../src/analysis/types/infer";
import { desugar } from "../src/analysis/desugar";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
  register(Injectable.TypeMap, new Map());
});

function clearIds(ast: Tree) {
  if (ast.children.length > 0) {
    ast.children.forEach(clearIds);
  }
  delete (ast as any).id;
  return ast;
}

const testCase = async (input: string) => {
  const tokens = parseTokenGroups(input);
  const ast = parseScript(tokens);
  const desugared = desugar(ast);
  expect(desugared).toMatchSnapshot();

  const context = new Context();
  infer(desugared, context);
  context.unificationTable.truncateTautologies();
  expect(context.unificationTable.constraints).toMatchSnapshot();

  substituteConstraints(desugared, context);
  const map = inject(Injectable.TypeMap);
  expect(map).toMatchSnapshot();
};

describe("compilation", () => {
  test("simple fix", async () => await testCase(`fn x -> x x`));
  test("fix", async () => await testCase(`(fn x -> x x) (fn x -> f(x x))`));
  test("either", async () => await testCase(`(((fn x -> fn m -> fn n -> m x) 1) fn x -> x) fn x -> x`));
  test("apply", async () => await testCase(`((fn f -> fn x -> f x) fn x -> x) 2`));
  test("wrapper", async () => await testCase(`(fn x -> fn m -> m x) 2 fn x -> x`));
  test("church tuple", async () => await testCase(`((fn x -> fn y -> fn m -> m x y) 1 2) fn x -> fn _ -> x`));
  test("function closure", async () => await testCase(`(fn x -> fn y -> y + 2 + x) 1 2`));
  test("function deep closure", async () => await testCase(`(fn x -> fn y -> fn z -> x + y + z) 1 3 5`));
  test("function application and literal", async () => await testCase(`(fn x -> x + x) 2`));
  test("float", async () => await testCase(`1.1`));
  test("int", async () => await testCase(`1`));
  test("sequence", async () => await testCase(`1; "hello world 2!"`));
  test("hello world string", async () => await testCase(`"hello world!"`));
  test.only("print 1", async () => await testCase(`print 1`));
  test.skip("print 2", async () => await testCase(`print "x"`));
  test.skip("print 3", async () => await testCase(`print 1; print "x"`));
  test.skip("function application and literal print", async () => await testCase(`print((fn x -> x + x) 2)`));
});
