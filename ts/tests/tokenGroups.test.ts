import { specialStringChars } from "../src/parser/tokens.js";
import { parseTokenGroups, _parseToken, TokenGroup, TokenGroupKind } from "../src/parser/tokenGroups.js";
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

function clearToken({ start, end, ...token }: any) {
  if (token.type === "group") {
    return {
      type: "group",
      kind: token.kind,
      tokens: token.tokens.map(clearToken),
    };
  }
  return token;
}

describe.only("string interpolation", () => {
  test.prop(
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

    const value: TokenGroup[] = interpolated.flatMap(([text, interpolated]): TokenGroup[] => [
      { type: "string", value: text } as TokenGroup,
      { type: "group", kind: TokenGroupKind.Parentheses, tokens: parseTokenGroups(interpolated) } as TokenGroup,
    ]);

    const src = `"${literal}"`;
    const startIndex = 0;
    const expectedIndex = src.length;
    const expectedToken = { type: "group", kind: TokenGroupKind.StringTemplate, tokens: value };

    const [{ index }, token] = _parseToken.parse(src, { index: startIndex, followSet: [] });
    console.dir({ token, expectedToken }, { depth: null });

    expect(index).toBe(expectedIndex);
    expect(clearToken(token)).toEqual(expectedToken);
  });
});

test("parseTokens", () => {
  const src = '42 "Hello" variable ((expr))';

  const tokens = parseTokenGroups(src);

  expect(tokens).toMatchSnapshot();
});

it.prop([anyStringArb])("parseTokenGroups never throws", (src) => {
  expect(() => parseTokenGroups(src)).not.toThrow();
});
