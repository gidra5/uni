import { specialStringChars } from "../src/parser/tokens.js";
import {
  parseTokenGroups,
  _parseToken,
  TokenGroup,
  TokenGroupKind,
  parseTokenGroup,
} from "../src/parser/tokenGroups.js";
import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
// import { describe, expect, test } from "vitest";
// import { fc } from "@fast-check/vitest";
import { type Arbitrary } from "fast-check";
import { Iterator } from "iterator-js";
import { eventLoopYield } from "../src/utils/index.js";

const anyStringArb = fc.string({ size: "large", unit: "binary" });
const stringInsidesArb = anyStringArb.filter((s) => !s.includes("\n") && !s.includes("\\") && !s.includes('"'));
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
  if (token.type === "error") {
    return {
      type: "error",
      cause: token.cause,
      token: token.token.map(clearToken),
    };
  }
  return token;
}

describe("string interpolation", () => {
  test.prop(
    [
      fc
        .array(stringInsidesArb)
        .chain((textSegments) =>
          arrayLenArb(
            anyStringArb.filter((s) => !s.includes("(") && !s.includes(")") && !s.includes('"')),
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
    {
      // seed: -968732021,
      // path: "2:2:1:5:8:10:12:13:13:0:0:0:1:3:2:3",
      // endOnFailure: true,
      examples: [
        [
          [
            '\\(")',
            [
              ["", '"'],
              ["", ""],
            ],
          ],
        ],
      ],
    }
  )("template strings", async ([literal, interpolated]) => {
    await eventLoopYield();
    const value: TokenGroup[] = interpolated
      .flatMap(([text, interpolated]): TokenGroup[] => [
        { type: "string", value: text } as TokenGroup,
        {
          type: "group",
          kind: TokenGroupKind.Parentheses,
          tokens: parseTokenGroup(")")
            .parse(interpolated + ")", { followSet: [], index: 0 })[1]
            .tokens.map(clearToken),
        } as TokenGroup,
      ])
      .slice(0, -1);
    if (value.length === 0) value.push({ type: "string", value: "" } as TokenGroup);
    const src = `"${literal}"`;
    const startIndex = 0;
    const expectedIndex = src.length;
    const expectedToken = { type: "group", kind: TokenGroupKind.StringTemplate, tokens: value };
    const [{ index }, token] = _parseToken.parse(src, { index: startIndex, followSet: [] });
    console.dir({ token: clearToken(token), expectedToken }, { depth: null });
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
