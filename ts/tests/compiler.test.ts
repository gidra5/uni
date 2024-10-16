import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";

const testCase = (src, expectedAsm?, scope?) => {
  // const [ast, errors] = parseScriptString(src, scope);
  const ast = parseScriptString(src, scope);
  const errors = [];
  console.dir(ast, { depth: null });

  const code = transform(ast);
  const asm = code.map(chunkToString);

  // console.dir(asm, { depth: null });
  expect(errors).toEqual([]);
  if (expectedAsm) expect(asm).toEqual(expectedAsm);
  expect(asm).toMatchSnapshot();
};

describe("compilation", () => {
  test.todo("function closure and multiple args", () => {
    const src = `(fn x -> fn y -> y + 2 * x) 1 2`;
    testCase(src);
  });

  test.todo("function application and literal", () => {
    const src = `(fn x -> x + x) 2`;
    testCase(src);
  });

  test.todo("hello world", () => {
    const src = `print "hello world!"`;
    testCase(src);
  });

  test.todo("hello world string", () => {
    const src = `"hello world!"`;
    testCase(src);
  });
});
