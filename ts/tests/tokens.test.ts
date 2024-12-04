import { parseToken, parseTokens, specialStringChars, type Token, type TokenPos } from "../src/parser/tokens.js";
import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { array, type Arbitrary } from "fast-check";
import { Iterator } from "iterator-js";
import { eventLoopYield } from "../src/utils/index.js";
import { SystemError } from "../src/error.js";

const anyStringArb = fc.string({ size: "large", unit: "binary" });
const commentArb = anyStringArb.filter((s) => !s.includes("\n"));
const blockCommentArb = anyStringArb.map((s) => s.replace("*/", "").replace("/*", ""));
const stringInsidesArb = anyStringArb.map((s) => s.replace("\\", "").replace('"', ""));
const charArb = fc.string({ minLength: 1, maxLength: 1 });
const notStringSpecialCharArb = charArb.filter((s) => !specialStringChars.includes(s));
const arrayLenArb = <T>(arb: Arbitrary<T>, len: number) => fc.array(arb, { minLength: len, maxLength: len });

describe("string token", () => {
  test.prop([stringInsidesArb])("simple string", async (value) => {
    await eventLoopYield();

    const src = `"${value}"`;
    const startIndex = 0;
    const expectedToken = { type: "string", src, value };
    const expectedIndex = value.length + 2;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) => {
        const literal = Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join();
        const value = Iterator.zip(strings, [...joins, ""])
          .flat()
          .join();
        return [literal, value];
      }),
  ])("string token escapes", async ([literal, value]) => {
    await eventLoopYield();

    const src = `"${literal}"`;
    const startIndex = 0;
    const expectedToken = { type: "string", src, value };
    const expectedIndex = literal.length + 2;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(token).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) =>
        Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join()
      ),
  ])("unclosed string token", async (literal) => {
    await eventLoopYield();

    const src = `"${literal}`;
    const startIndex = 0;
    const expectedIndex = literal.length + 1;
    const expectedToken = {
      type: "error",
      src,
      cause: SystemError.unterminatedString({ start: 0, end: expectedIndex }),
    };

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  test.prop([
    fc
      .array(stringInsidesArb)
      .chain((strings) => arrayLenArb(notStringSpecialCharArb, strings.length).map((joins) => [strings, joins]))
      .map(([strings, joins]) =>
        Iterator.zip(strings, [...joins.map((x) => "\\" + x), ""])
          .flat()
          .join()
      ),
  ])("unclosed string token escape", async (literal) => {
    await eventLoopYield();

    const src = `"${literal}\\`;
    const startIndex = 0;
    const expectedIndex = literal.length + 2;
    const expectedToken = {
      type: "error",
      src,
      cause: SystemError.unterminatedString({ start: 0, end: expectedIndex }),
    };

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });
});

describe("number token", () => {
  it.prop([fc.stringMatching(/^\d+\.\d+$/)])("float literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src) };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d+$/)])("int literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src) };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d+\.$/)])("trailing dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src + "0") };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\.\d+$/)])("prefix dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number("0" + src) };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\d[\d_]*\d$/)])("int literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: "number",
      src,
      value: Number(src.replace(/_/g, "")),
    };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^\.\d[\d_]*\d$/)])("float literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: "number",
      src,
      value: Number(src.replace(/_/g, "")),
    };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0x[\da-fA-F][\da-fA-F_]*[\da-fA-F]$/)])("hex literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: "number",
      src,
      value: Number(src.replace(/_/g, "")),
    };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0o[0-7][0-7_]*[0-7]$/)])("octal literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: "number",
      src,
      value: Number(src.replace(/_/g, "")),
    };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^0b[01][01_]*[01]$/)])("binary literals with spacers", (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: "number",
      src,
      value: Number(src.replace(/_/g, "")),
    };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect((token as any).value).toEqual(expectedToken.value);
    expect(token).toEqual(expectedToken);
  });
});

describe("identifier token", () => {
  it.prop([fc.stringMatching(/^[a-zA-Z]\w*$/)])("regular idents", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "identifier", src };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([fc.stringMatching(/^_+$/)])("placeholders", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "placeholder", src };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(src, { index: startIndex });

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });
});

describe("comments", () => {
  it.prop([fc.stringMatching(/[^\n]*/)])("single line comments", (comment) => {
    const src = `//${comment}\n`;
    const input = `${src}12412434`;
    const startIndex = 0;
    const expectedToken = { type: "newline", src };
    const expectedIndex = src.length;

    const [{ index }, { start, end, ...token }] = parseToken.parse(input, { index: startIndex });

    expect(start).toBe(0);
    expect(end).toBe(expectedIndex);
    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([blockCommentArb])("multi line comments", (comment) => {
    const src = `/*${comment}*/`;
    const input = `${src}_`;
    const startIndex = 0;
    const expectedToken = { type: "placeholder", src: "_" };
    const expectedStart = src.length;
    const expectedIndex = src.length + 1;

    const [{ index }, { start, end, ...token }] = parseToken.parse(input, { index: startIndex });

    expect(start).toBe(expectedStart);
    expect(end).toBe(expectedIndex);
    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
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
    let expectedStart: number;
    let expectedToken: Token;
    if (src.includes("\n")) {
      expectedToken = { type: "newline", src };
      expectedStart = 0;
      expectedIndex = src.length;
    } else {
      expectedToken = { type: "placeholder", src: "_" };
      expectedStart = src.length;
      expectedIndex = src.length + 1;
    }

    const [{ index }, { start, end, ...token }] = parseToken.parse(input, { index: startIndex });

    expect(start).toBe(expectedStart);
    expect(end).toBe(expectedIndex);
    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
  });

  it.prop([anyStringArb])("adding line comments instead of newlines never changes the resulting tokens", (src) => {
    const tokens = parseTokens(src);
    const withComments = parseTokens(withLineComments());

    expect(mapTokens(tokens)).toStrictEqual(mapTokens(withComments));

    function mapTokens(tokens: typeof withComments) {
      return tokens.map(({ start, end, ...token }) => {
        if (token.type === "newline") return { type: "newline" };
        return token;
      });
    }

    function withLineComments(): string {
      let result = src;
      for (const token of [...tokens].reverse()) {
        if (token.type === "newline") {
          const startString = result.substring(0, token.start);
          const endString = result.substring(token.end);
          result = `${startString}//\n${endString}`;
        }
      }
      return result;
    }
  });

  it.prop([anyStringArb])("adding block comments between tokens never changes the result", (src) => {
    const tokens = parseTokens(src);
    const withComments = parseTokens(withLineComments());

    expect(mapTokens(tokens)).toStrictEqual(mapTokens(withComments));

    function mapTokens(tokens: typeof withComments) {
      return tokens.map(({ start, end, ...token }) => {
        if (token.type === "newline") return { type: "newline" };
        return token;
      });
    }

    function withLineComments(): string {
      let result = src;
      for (const [token1, token2] of [...Iterator.iter(tokens).window(2)].reverse()) {
        const startString = result.substring(0, token1.end);
        const endString = result.substring(token2.start);
        result = `${startString}/**/${endString}`;
      }
      result = `/**/${result}/**/`;
      return result;
    }
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
