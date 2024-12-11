import { parseMultilineStringToken, parseStringToken, parseToken, specialStringChars } from "../src/parser/tokens.js";
import { beforeEach, describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { array, type Arbitrary } from "fast-check";
import { Iterator } from "iterator-js";
import { eventLoopYield, getPos } from "../src/utils/index.js";
import { SystemError } from "../src/error.js";
import { position } from "../src/position.js";
import { Injectable, register } from "../src/injector.js";

beforeEach(() => {
  register(Injectable.NextId, 0);
  register(Injectable.PositionMap, new Map());
});

const anyStringArb = fc.string({ size: "large", unit: "binary" });
const commentArb = anyStringArb.filter((s) => !s.includes("\n"));
const blockCommentArb = anyStringArb.map((s) => s.replace("*/", "").replace("/*", ""));
const stringInsidesArb = anyStringArb
  .filter((s) => !s.includes("\n") && !s.includes("\\"))
  .map((s) => s.replace('"', ""));
const charArb = fc.string({ minLength: 1, maxLength: 1 });
const notStringSpecialCharArb = charArb.filter((s) => !specialStringChars.includes(s) && s !== "(");
const arrayLenArb = <T>(arb: Arbitrary<T>, len: number) => fc.array(arb, { minLength: len, maxLength: len });

function dropId({ id, ...token }: any) {
  if ("token" in token) return { ...token, token: dropId(token.token) };
  return token;
}

describe("string token", () => {
  test.prop([stringInsidesArb])("simple string", async (value) => {
    await eventLoopYield();

    const src = `${value}"`;
    const startIndex = 0;
    const expectedToken = { type: "lastSegment", value };
    const expectedIndex = value.length ;

    const [{ index }, token] = parseStringToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) => {
        const literal = Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join("");
        const value = Iterator.zip(strings, [...joins, ""])
          .flat()
          .join("");
        return [literal, value];
      }),
  ])("string token escapes", async ([literal, value]) => {
    await eventLoopYield();

    const src = `${literal}"`;
    const startIndex = 0;
    const expectedToken = { type: "lastSegment", value };
    const expectedIndex = literal.length;

    const [{ index }, token] = parseStringToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(dropId(token)).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) =>
        Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join("")
      ),
  ])("unclosed string token", async (literal) => {
    await eventLoopYield();

    const src = literal;
    const startIndex = 0;
    const expectedIndex = literal.length;
    const expectedToken = {
      type: "error",
      cause: SystemError.unterminatedString(position(startIndex, expectedIndex)),
    };

    const [{ index }, { value: _, ...token }] = parseStringToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) =>
        Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join("")
      ),
  ])("unclosed string token escape", async (literal) => {
    await eventLoopYield();

    const src = `${literal}\\`;
    const startIndex = 0;
    const expectedIndex = literal.length + 1;
    const expectedToken = {
      type: "error",
      cause: SystemError.unterminatedString(position(startIndex, expectedIndex)),
    };

    const [{ index }, { value: _, ...token }] = parseStringToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  test.prop([stringInsidesArb])("unclosed string token before newline", async (literal) => {
    await eventLoopYield();

    const src = `${literal}\n`;
    const startIndex = 0;
    const expectedIndex = literal.length;
    const pos = position(startIndex, expectedIndex);
    const expectedToken = {
      type: "error",
      value: literal,
      cause: SystemError.unterminatedString(pos),
    };

    const [{ index }, token] = parseStringToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  test.prop([
    fc.array(stringInsidesArb).chain((segments) =>
      fc
        .stringMatching(/^\s*$/)
        .filter((s) => !s.includes("\n"))
        .map((s) => "\n" + s)
        .map((intend) => [intend, segments] as const)
    ),
  ])("multiline strings", async ([intend, segments]) => {
    await eventLoopYield();

    const literal = segments.join(intend);
    const value = segments.join("\n").trimEnd();
    const src = `${literal}"""`;
    const startIndex = 0;
    const expectedIndex = literal.length;
    const expectedToken = { type: "lastSegment", value };

    const [{ index }, token] = parseMultilineStringToken(intend).parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });
});

describe("number token", () => {
  it.prop([fc.stringMatching(/^\d+\.\d+$/)])("float literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d+$/)])("int literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d+\.$/)])("trailing dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src + "0") };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\.\d+$/)])("prefix dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number("0" + src) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d[\d_]*\d$/)])("int literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src.replace(/_/g, "")) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\.\d[\d_]*\d$/)])("float literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src.replace(/_/g, "")) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0x[\da-fA-F][\da-fA-F_]*[\da-fA-F]$/)])("hex literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src.replace(/_/g, "")) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0o[0-7][0-7_]*[0-7]$/)])("octal literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src.replace(/_/g, "")) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0b[01][01_]*[01]$/)])("binary literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", value: Number(src.replace(/_/g, "")) };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(dropId(token)).toEqual(expectedToken);
  });
});

describe("identifier token", () => {
  it.prop([fc.stringMatching(/^[a-zA-Z]\w*$/)])("regular idents", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "identifier", name: src };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^_+$/)])("placeholders", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "placeholder" };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });
});

describe("comments", () => {
  it.prop([fc.stringMatching(/[^\n]*/)])("single line comments", (comment) => {
    const src = `//${comment}\n`;
    const input = `${src}12412434`;
    const startIndex = 0;
    const expectedToken = { type: "newline" };
    const expectedIndex = src.length;

    const [{ index }, token] = parseToken.parse(input, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([blockCommentArb])("multi line comments", (comment) => {
    const src = `/*${comment}*/`;
    const input = `${src}_`;
    const startIndex = 0;
    const expectedToken = { type: "placeholder" };
    const expectedPos = { start: src.length, end: src.length + 1 };
    const expectedIndex = expectedPos.end;

    const [{ index }, token] = parseToken.parse(input, { index: startIndex });
    const pos = getPos(token.id);

    expect(pos).toEqual(expectedPos);
    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([
    array(
      fc.oneof(
        fc.constant("\n"),
        commentArb.map((comment) => `//${comment}\n`),
        blockCommentArb.filter((t) => !t.includes("\n")).map((comment) => `/*${comment}*/`)
      )
    ).map((parts) => parts.join("")),
  ])("multiple comments", (src) => {
    const input = `${src}_`;
    const startIndex = 0;

    let expectedIndex: number;
    let expectedToken: { type: string };
    if (src.includes("\n")) {
      expectedToken = { type: "newline" };
      expectedIndex = src.length;
    } else {
      expectedToken = { type: "placeholder" };
      expectedIndex = src.length + 1;
    }

    const [{ index }, token] = parseToken.parse(input, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(dropId(token)).toEqual(expectedToken);
  });

  it.prop([anyStringArb])("adding line comments instead of newlines never changes the resulting token", (src) => {
    const [, token] = parseToken.parse(src, { index: 0 });
    const [, withComments] = parseToken.parse(withLineComments(), { index: 0 });

    expect(dropId(token)).toStrictEqual(dropId(withComments));

    function withLineComments(): string {
      if (token.type === "newline") {
        const end = getPos(token.id)!.end;
        const tail = src.substring(end);
        return `//\n${tail}`;
      }
      return src;
    }
  });

  it.prop([anyStringArb])("adding block comments never changes the result", (src) => {
    const [, token] = parseToken.parse(src, { index: 0 });
    const [, withComments] = parseToken.parse(`/**/${src}/**/`, { index: 0 });

    expect(dropId(token)).toStrictEqual(dropId(withComments));
  });
});

it.prop([anyStringArb])("parseToken never throws", (src) => {
  expect(() => parseToken.parse(src, { index: 0 })).not.toThrow();
});

it.prop([anyStringArb])("parseStringToken never throws", (src) => {
  expect(() => parseStringToken.parse(src, { index: 0 })).not.toThrow();
});

it.prop([anyStringArb, fc.stringMatching(/\n\s*/)])("parseMultilineStringToken never throws", (src, intend) => {
  const parser = parseMultilineStringToken(intend);
  expect(() => parser.parse(src, { index: 0 })).not.toThrow();
});
