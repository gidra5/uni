import { specialStringChars } from "../src/parser/tokens.js";
import {
  parseTokenGroups,
  _parseToken,
  TokenGroup,
  TokenGroupKind,
  parseTokenGroup,
} from "../src/parser/tokenGroups.js";
import { beforeEach, describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { type Arbitrary } from "fast-check";
import { Iterator } from "iterator-js";
import { eventLoopYield, getPos } from "../src/utils/index.js";
import { Injectable, register } from "../src/injector.js";

beforeEach(() => {
  register(Injectable.NextId, 0);
  register(Injectable.PositionMap, new Map());
});

const anyStringArb = fc.string({ size: "large", unit: "binary" });
const stringInsidesArb = anyStringArb.filter((s) => !s.includes("\n") && !s.includes("\\") && !s.includes('"'));
const charArb = fc.string({ minLength: 1, maxLength: 1 });
const notStringSpecialCharArb = charArb.filter((s) => !specialStringChars.includes(s));
const arrayLenArb = <T>(arb: Arbitrary<T>, len: number) => fc.array(arb, { minLength: len, maxLength: len });

function clearIds({ id, ...token }: any) {
  if (token.type === "group") return { ...token, tokens: token.tokens.map(clearIds) };
  if (token.type === "error") return { ...token, token: clearIds(token.token) };
  return token;
}

const testCase = (input: string) => {
  const tokenGroups = parseTokenGroups(input);
  expect(tokenGroups.map(clearIds)).toMatchSnapshot();
};

describe("group kinds", () => {
  describe("pair groups", () => {
    test("parens", () => testCase("(x)"));
    test("brackets", () => testCase("[x]"));
    test("braces", () => testCase("{x}"));
  });

  describe("for group", () => {
    test("for colon", () => testCase("for x in y: z"));
    test("for arrow", () => testCase("for x in y -> z"));
    test("for braces", () => testCase("for x in y { z }"));

    describe.todo("errors", () => {
      test("parseTokens", () => testCase("for x in y {"));
      test("parseTokens", () => testCase("for x in y }"));
      test("parseTokens", () => testCase("for x { z }"));
      test("parseTokens", () => testCase("for x in y"));
      test("parseTokens", () => testCase("for x : z"));
      test("parseTokens", () => testCase("for x -> z"));
      test("parseTokens", () => testCase("for x }"));
      test("parseTokens", () => testCase("for x {"));
      test("parseTokens", () => testCase("{ for x } }"));
      test("parseTokens", () => testCase("for x"));
    });
  });

  describe.todo("while group", () => {
    test("parseTokens", () => testCase("while x: z"));
    test("parseTokens", () => testCase("while x -> z"));
    test("parseTokens", () => testCase("while x { z }"));
  });

  describe.todo("inject group", () => {
    test("parseTokens", () => testCase("inject x: z"));
    test("parseTokens", () => testCase("inject x -> z"));
    test("parseTokens", () => testCase("inject x { z }"));
  });

  describe.todo("mask group", () => {
    test("parseTokens", () => testCase("mask x: z"));
    test("parseTokens", () => testCase("mask x -> z"));
    test("parseTokens", () => testCase("mask x { z }"));
  });

  describe.todo("without group", () => {
    test("parseTokens", () => testCase("without x: z"));
    test("parseTokens", () => testCase("without x -> z"));
    test("parseTokens", () => testCase("without x { z }"));
  });

  describe.todo("fn group", () => {
    test("parseTokens", () => testCase("fn x: z"));
    test("parseTokens", () => testCase("fn x -> z"));
    test("parseTokens", () => testCase("fn x { z }"));
    test("parseTokens", () => testCase("fn x -> y { z }"));
  });

  describe.todo("if group", () => {
    test("parseTokens", () => testCase("if y: z"));
    test("parseTokens", () => testCase("if y { z }"));
    test("parseTokens", () => testCase("if y -> z"));
    test("parseTokens", () => testCase("if y: z else x"));
    test("parseTokens", () => testCase("if y { z } else x"));
  });

  describe.todo("record group", () => {
    test("parseTokens", () => testCase("record { a }"));
    test("parseTokens", () => testCase("dict { a }"));
  });

  describe.todo("match group", () => {
    test("parseTokens", () => testCase("match x { a }"));
  });
});

test.prop([
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
])("template strings", async ([literal, interpolated]) => {
  await eventLoopYield();
  const value: TokenGroup[] = interpolated
    .flatMap(([text, interpolated]): TokenGroup[] => [
      { type: "string", value: text } as TokenGroup,
      {
        type: "group",
        kind: TokenGroupKind.Parentheses,
        tokens: parseTokenGroup(")")
          .parse(interpolated + ")", { followSet: [], index: 0 })[1]
          .tokens.tokens.map(clearIds),
      } as TokenGroup,
    ])
    .slice(0, -1);
  if (value.length === 0) value.push({ type: "string", value: "" } as TokenGroup);

  const src = `"${literal}"`;
  const startIndex = 0;
  const expectedIndex = src.length;
  const expectedToken = { type: "group", kind: TokenGroupKind.StringTemplate, tokens: value };
  const [{ index }, token] = _parseToken.parse(src, { index: startIndex, followSet: [] });

  expect(index).toBe(expectedIndex);
  expect(clearIds(token)).toEqual(expectedToken);
});

test("parseTokens", () => testCase('42 "Hello" variable ((expr))'));

it.prop([anyStringArb])("parseTokenGroups never throws", (src) => {
  expect(() => parseTokenGroups(src)).not.toThrow();
});

it.prop([anyStringArb])("parseTokenGroups positions are correctly nested", (src) => {
  const tokenGroup = parseTokenGroups(src);

  check(tokenGroup);

  function check(tg: TokenGroup[], start = 0, end = src.length) {
    tg.forEach(function checkToken(tg: TokenGroup) {
      if (tg.type === "group") {
        if ("kind" in tg) {
          const pos = getPos(tg.id)!;
          check(tg.tokens, pos.start, pos.end);
        } else {
          check(tg.tokens, start, end);
        }
        return;
      }
      if (tg.type === "error") {
        checkToken(tg.token);
        return;
      }

      const pos = getPos(tg.id)!;
      expect(pos.start >= start);
      expect(pos.end <= end);
    });
  }
});
