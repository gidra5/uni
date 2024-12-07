import { parseToken, specialStringChars, type Token } from "../src/parser/tokens.js";
import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { array, type Arbitrary } from "fast-check";
import { Iterator } from "iterator-js";
import { eventLoopYield } from "../src/utils/index.js";
import { SystemError } from "../src/error.js";
import { position } from "../src/position.js";

const anyStringArb = fc.string({ size: "large", unit: "binary" });
const commentArb = anyStringArb.filter((s) => !s.includes("\n"));
const blockCommentArb = anyStringArb.map((s) => s.replace("*/", "").replace("/*", ""));
const stringInsidesArb = anyStringArb
  .filter((s) => !s.includes("\n") && !s.includes("\\"))
  .map((s) => s.replace('"', ""));
const charArb = fc.string({ minLength: 1, maxLength: 1 });
const notStringSpecialCharArb = charArb.filter((s) => !specialStringChars.includes(s));
const arrayLenArb = <T>(arb: Arbitrary<T>, len: number) => fc.array(arb, { minLength: len, maxLength: len });

describe.todo("string interpolation", () => {});

test("parseTokens", () => {
  const src = '42 "Hello" variable ((expr))';

  const tokens = parseTokens(src);

  expect(tokens).toMatchSnapshot();
});

it.prop([anyStringArb])("parseTokens never throws", (src) => {
  expect(() => parseTokens(src)).not.toThrow();
});
