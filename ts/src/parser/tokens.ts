import { SystemError } from "../error.js";
import { type Position } from "../position.js";
import { Parser } from "./utils.js";

export const symbols = [
  "::",
  "<-",
  "?<-",
  "<-?",
  "->",
  "--",
  "++",
  "+=",
  "//",
  "/*",
  "*/",
  "!=",
  "==",
  ">=",
  "<=",
  ":=",
  "|>",
  "===",
  "!==",
  "...",
];

// Sort symbols by length in descending order
symbols.sort((a, b) => b.length - a.length);

const specialStringCharTable = {
  "0": "\0",
  r: "\r",
  n: "\n",
  t: "\t",
};

export const specialStringChars = Object.keys(specialStringCharTable);

export type Token =
  | { type: "error"; src: string; cause: SystemError }
  | { type: "placeholder"; src: string }
  | { type: "identifier" | "newline"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string; value: string };

export type TokenPos = Token & Position;

export const identifier = (src: string, pos: Position): TokenPos => ({
  type: "identifier",
  src,
  ...pos,
});
export const newline = (src: string, pos: Position): TokenPos => ({
  type: "newline",
  src,
  ...pos,
});
export const number = (src: string, pos: Position, value: number): TokenPos => ({ type: "number", src, value, ...pos });
export const string = (src: string, pos: Position, value: string): TokenPos => ({ type: "string", src, value, ...pos });
export const error = (cause: SystemError, pos: Position, src = ""): TokenPos => ({ type: "error", cause, src, ...pos });
export const placeholder = (src: string, pos: Position): TokenPos => ({
  type: "placeholder",
  src,
  ...pos,
});

const stringLiteralError = function* () {
  const tokenSrc = yield Parser.substring();
  const pos = yield Parser.span();
  return error(SystemError.unterminatedString(pos), pos, tokenSrc);
};

const hexLiteralError = Parser.do(function* () {
  const pos = yield Parser.span();
  const tokenSrc = yield Parser.substring();
  return error(SystemError.invalidHexLiteral(pos), pos, tokenSrc);
});

const octalLiteralError = Parser.do(function* () {
  const pos = yield Parser.span();
  const tokenSrc = yield Parser.substring();
  return error(SystemError.invalidOctalLiteral(pos), pos, tokenSrc);
});

const binaryLiteralError = Parser.do(function* () {
  const pos = yield Parser.span();
  const tokenSrc = yield Parser.substring();
  return error(SystemError.invalidBinaryLiteral(pos), pos, tokenSrc);
});

const _number = function* (value: string) {
  return number(yield Parser.substring(), yield Parser.span(), Number(value));
};

const _newline = function* () {
  return newline(yield Parser.substring(), yield Parser.span());
};

const _string = function* (value: string) {
  return string(yield Parser.substring(), yield Parser.span(), value);
};

const _identifier = function* (ident: string) {
  return identifier(ident, yield Parser.span());
};

const _placeholder = function* (ident: string) {
  return placeholder(ident, yield Parser.span());
};

const parseHexStyleLiteral = (prefix: string, digitRegexp: RegExp, error: Parser<string, TokenPos>) =>
  Parser.do(function* () {
    if (!(yield Parser.checkRegexp(digitRegexp))) {
      while ((yield Parser.regexp(digitRegexp)) || (yield Parser.string("_"))) {}
      return yield error;
    }

    let value = prefix;
    while ((yield Parser.checkRegexp(digitRegexp)) || (yield Parser.checkString("_"))) {
      const prev = yield Parser.nextChar();
      if (prev !== "_") value += prev;
    }

    return yield* _number(value);
  });

export const parseToken = Parser.do<string, TokenPos>(function* () {
  yield Parser.rememberIndex();
  let isNewline = false;

  while (true) {
    if (yield Parser.string("/*")) {
      yield Parser.untilString("*/");
      continue;
    }

    if (yield Parser.checkRegexp(/\s/)) {
      if (yield Parser.checkString("\n")) isNewline = true;
      yield Parser.advance();
      continue;
    }

    if (yield Parser.string("//")) {
      yield Parser.untilString("\n");
      isNewline = true;
      continue;
    }

    break;
  }

  if (isNewline) return yield* _newline();

  yield Parser.rememberIndex();

  if (yield Parser.string('"')) {
    let value = "";

    while (!(yield Parser.string('"'))) {
      if (yield Parser.isEnd()) return yield* stringLiteralError();

      if (yield Parser.string("\\")) {
        if (yield Parser.isEnd()) continue;

        const char: keyof typeof specialStringCharTable | null = yield Parser.oneOfStrings(...specialStringChars);
        if (char) {
          value += specialStringCharTable[char];
          continue;
        }
      }

      value += yield Parser.nextChar();
    }

    return yield* _string(value);
  }

  if (yield Parser.string("0x")) return yield parseHexStyleLiteral("0x", /[0-9a-fA-F]/, hexLiteralError);
  if (yield Parser.string("0o")) return yield parseHexStyleLiteral("0o", /[0-7]/, octalLiteralError);
  if (yield Parser.string("0b")) return yield parseHexStyleLiteral("0b", /[01]/, binaryLiteralError);

  if (yield Parser.checkRegexp(/\d/)) {
    let value = "";

    while (yield Parser.checkRegexp(/\d/)) {
      value += yield Parser.nextChar();
      while (yield Parser.string("_")) {}
    }
    if (yield Parser.checkString(".")) value += yield Parser.nextChar();
    while (yield Parser.checkRegexp(/\d/)) {
      value += yield Parser.nextChar();
      while (yield Parser.string("_")) {}
    }

    return yield* _number(value);
  }

  if ((yield Parser.checkString(".")) && /\d/.test(yield Parser.peekChar(1))) {
    yield Parser.advance();
    let value = "0.";

    while (yield Parser.checkRegexp(/\d/)) {
      value += yield Parser.nextChar();
      while (yield Parser.string("_")) {}
    }

    return yield* _number(value);
  }

  if (yield Parser.checkRegexp(/[a-zA-Z_]/)) {
    while (yield Parser.regexp(/\w/)) {}

    const ident = yield Parser.substring();
    if (/^_+$/.test(ident)) return yield* _placeholder(ident);
    return yield* _identifier(ident);
  }

  for (const symbol of symbols) {
    if (yield Parser.string(symbol)) return yield* _identifier(symbol);
  }

  return yield* _identifier(yield Parser.nextChar());
});

export const parseTokens = parseToken.all({ index: 0 });