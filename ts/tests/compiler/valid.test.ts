import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { testCase } from "./utils";

describe("compilation", () => {
  test("function closure and multiple args", () => {
    const src = `(fn x -> fn y -> y + 2 * x) 1 2`;
    testCase(src);
  });

  test("function application and literal", () => {
    const src = `(fn x -> x + x) 2`;
    testCase(src);
  });

  test("hello world", () => {
    const src = `print "hello world!"`;
    testCase(src);
  });

  test("hello world string", () => {
    const src = `"hello world!"`;
    testCase(src);
  });
});
