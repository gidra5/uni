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

describe.todo("string interpolation", () => {
  function clearToken({ start, end, ...token }: TokenPos | (Position & { type: "skip" })) {
    if (token.type === "newline") return { type: "newline" };
    if (token.type === "string") {
      return {
        type: "string",
        src: token.src,
        value: token.value.map((v) => {
          if (typeof v === "string") return v;
          return v.map(clearToken);
        }),
      };
    }
    return token;
  }

  test.todo.prop(
    [
      fc
        .array(stringInsidesArb)
        .chain((textSegments) =>
          arrayLenArb(
            anyStringArb.filter((s) => !s.includes("(") && !s.includes(")")),
            Math.max(textSegments.length - 1, 0)
          ).map((joins) => [textSegments, joins])
        )
        .map(([strings, joins]) => {
          const literal = Iterator.zip(strings, [...joins.map((x) => `\\(${x})`), ""])
            .flat()
            .join("");
          const value = Iterator.zip(strings, [...joins, ""]);
          return [literal, value.toArray()] as const;
        }),
    ],
    { seed: -426290917, path: "0:1:0:0:1:2:2", endOnFailure: true }
  )("template strings", async ([literal, interpolated]) => {
    await eventLoopYield();

    const value = interpolated
      .flatMap(([text, interpolated]) => [text, parseTokens(interpolated).map(clearToken)])
      .map((v) =>
        Array.isArray(v) && v.length === 0
          ? [{ type: "error", src: "", cause: SystemError.unterminatedString(position(0, 0)) }]
          : v
      )
      .filter((v) => v.length > 0);

    const src = `"${literal}"`;
    const startIndex = 0;
    const expectedIndex = src.length;
    const expectedToken = { type: "string", src, value };

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });
    console.dir({ token, expectedToken }, { depth: null });

    expect(index).toBe(expectedIndex);
    expect(clearToken(token)).toEqual(expectedToken);
  });
});

test("parseTokens", () => {
  const src = '42 "Hello" variable ((expr))';

  const tokens = parseTokens(src);

  expect(tokens).toMatchSnapshot();
});

it.prop([anyStringArb])("parseTokens never throws", (src) => {
  expect(() => parseTokens(src)).not.toThrow();
});
