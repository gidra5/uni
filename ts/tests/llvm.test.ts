import { beforeEach, describe, expect } from "vitest";
import { test } from "@fast-check/vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { generateLLVMCode } from "../src/codegen/llvm";
import { exec } from "child_process";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { inferTypes } from "../src/analysis/types/infer";
import { desugar } from "../src/analysis/desugar";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.NextId, 0);
  register(Injectable.PositionMap, new Map());
  register(Injectable.TypeMap, new Map());
  register(Injectable.PhysicalTypeMap, new Map());
  register(Injectable.ClosureVariablesMap, new Map());
  register(Injectable.BoundVariablesMap, new Map());
  register(Injectable.NodeToVariableMap, new Map());
});

const testCase = async (src: string) => {
  const tokens = parseTokenGroups(src);
  const ast = parseScript(tokens);
  const desugared = desugar(ast);
  inferTypes(desugared);
  const compiled = generateLLVMCode(desugared);
  expect(compiled).toMatchSnapshot("compiled");

  // const optimized: any[] = [];
  const stdout: any[] = [];
  const stderr: any[] = [];
  const interpreter = exec("lli-18");
  const optimizer = exec(`opt-18 -f -S -O3`);
  interpreter.stdout?.on("data", (data) => stdout.push(data));
  interpreter.stderr?.on("data", (data) => stderr.push(data));
  optimizer.stderr?.on("data", (data) => stderr.push(data));
  optimizer.stdout?.pipe(interpreter.stdin!);
  // optimizer.stdout?.on("data", (data) => optimized.push(data));
  optimizer.stdin?.write(compiled);
  optimizer.stdin?.end();

  await new Promise((resolve) => interpreter.on("exit", resolve));

  // expect(optimized.join("")).toMatchSnapshot("optimized");
  expect(stdout).toMatchSnapshot("stdout");
  expect(stderr).toMatchSnapshot("stderr");
};

describe("compilation", () => {
  test.todo(
    "either",
    async () =>
      await testCase(`print(
        (((fn x -> fn m -> fn n -> m x) 1) (fn x -> x)) (fn x -> x)
      )`)
  );
  test.todo(
    "apply",
    async () =>
      await testCase(`print(
        ((fn f -> fn x -> f x) fn x -> x) 2
      )`)
  );
  test.todo(
    "wrapper",
    async () =>
      await testCase(`print(
        ((fn x -> fn m -> m x) 2) fn x -> x  
      )`)
  );
  test.todo(
    "church tuple",
    async () =>
      await testCase(`print(
        ((fn x -> fn y -> fn m -> m x y) 1 2) fn x -> fn _ -> x
      )`)
  );
  test.todo("function closure", async () => await testCase(`print((fn x -> fn y -> y + 2 * x) 1 2)`));
  test.todo("function deep closure", async () => await testCase(`print((fn x -> fn y -> fn z -> x + y + z) 1 3 5)`));
  test.only("function application and literal print", async () => await testCase(`print((fn x -> x + x) 2)`));
  test("print number", async () => await testCase(`print 1`));
  test("hello world", async () => await testCase(`print "hello world!"`));
  test("hello world twice", async () => await testCase(`print "hello world!"; print "hello world!"`));
  test("two prints", async () => await testCase(`print "hello world!"; print "hello world 2!"`));
  test("hello world string", async () => await testCase(`"hello world!"`));
});
