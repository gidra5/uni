import { beforeEach, describe, expect, test } from "vitest";
import { Tree } from "../src/ast";
import { parseScript } from "../src/parser/parser";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { inferTypes } from "../src/analysis/types/infer";
import { desugar } from "../src/analysis/desugar";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.ASTNodePrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
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
  inferTypes(desugared);

  expect(clearIds(ast)).toMatchSnapshot();
};

describe("compilation", () => {
  test.todo("either", async () => await testCase(`((fn x -> fn m -> fn n -> m x) 1) (fn x -> x)) fn x -> x`));
  test.todo("apply", async () => await testCase(`((fn f -> fn x -> f x) fn x -> x) 2`));
  test.todo("wrapper", async () => await testCase(`((fn x -> fn m -> m x) 2) fn x -> x`));
  test.todo("church tuple", async () => await testCase(`((fn x -> fn y -> fn m -> m x y) 1 2) fn x -> fn _ -> x`));
  test.todo("function closure", async () => await testCase(`(fn x -> fn y -> y + 2 * x) 1 2`));
  test("function deep closure", async () => await testCase(`(fn x -> fn y -> fn z -> x + y + z) 1 3 5`));
  test("function application and literal", async () => await testCase(`(fn x -> x + x) 2`));
  test("float", async () => await testCase(`1.1`));
  test("int", async () => await testCase(`1`));
  test("two prints", async () => await testCase(`"hello world!"; "hello world 2!"`));
  test("hello world string", async () => await testCase(`"hello world!"`));
});
