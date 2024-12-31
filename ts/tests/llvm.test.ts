import { beforeEach, describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { generateLLVMCode } from "../src/codegen/llvm";
import { exec } from "child_process";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.ASTNodePrecedenceMap, new Map());
  register(Injectable.NextId, 0);
  register(Injectable.PositionMap, new Map());
});

const testCase = async (src: string) => {
  const tokens = parseTokenGroups(src);
  const x = parseScript(tokens);
  const compiled = generateLLVMCode(x);
  expect(compiled).toMatchSnapshot("compiled");

  const stdout: any[] = [];
  const stderr: any[] = [];
  const child = exec("lli-18");
  child.stdout?.on("data", (data) => stdout.push(data));
  child.stderr?.on("data", (data) => stderr.push(data));
  child.stdin?.write(compiled);
  child.stdin?.end();

  await new Promise((resolve) => child.on("exit", resolve));

  expect(stdout).toMatchSnapshot("stdout");
  expect(stderr).toMatchSnapshot("stderr");
};

describe("compilation", () => {
  test.only("function closure ", async () => await testCase(`print((fn x -> fn y -> y + 2 * x) 1 2)`));
  test("function application and literal print", async () => await testCase(`print((fn x -> x + x) 2)`));
  test("hello world", async () => await testCase(`print "hello world!"`));
  test("hello world twice", async () => await testCase(`print "hello world!"; print "hello world!"`));
  test("two prints", async () => await testCase(`print "hello world!"; print "hello world 2!"`));
  test("hello world string", async () => await testCase(`"hello world!"`));
});
