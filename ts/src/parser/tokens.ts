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

type SkipToken = { type: "skip" };
type SkipTokenPos = SkipToken & Position;

type ErrorToken = Exclude<Token, { type: "error" }>;
export type Token =
  | { type: "error"; src: string; cause: SystemError; token: ErrorToken }
  | { type: "placeholder" | "newline"; src: string }
  | { type: "identifier"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string }
  | { type: "multilineString"; src: string; intend: string };

export type StringToken =
  | { type: "error"; src: string; cause: SystemError; value: string }
  | { type: "segment"; src: string; value: string }
  | { type: "lastSegment"; src: string; value: string };

export type TokenPos = Token & Position;
export type StringTokenPos = StringToken & Position;

const hexLiteralError = Parser.do(function* () {
  const src: string = yield Parser.substring();
  const pos: Position = yield Parser.span();
  const cause = SystemError.invalidHexLiteral(pos);
  const token = { type: "number", value: 0, src, ...pos } satisfies TokenPos;
  return { type: "error", cause, token, src, ...pos } satisfies TokenPos;
});

const octalLiteralError = Parser.do(function* () {
  const src: string = yield Parser.substring();
  const pos: Position = yield Parser.span();
  const cause = SystemError.invalidOctalLiteral(pos);
  const token = { type: "number", value: 0, src, ...pos } satisfies TokenPos;
  return { type: "error", cause, token, src, ...pos } satisfies TokenPos;
});

const binaryLiteralError = Parser.do(function* () {
  const src: string = yield Parser.substring();
  const pos: Position = yield Parser.span();
  const cause = SystemError.invalidBinaryLiteral(pos);
  const token = { type: "number", value: 0, src, ...pos } satisfies TokenPos;
  return { type: "error", cause, token, src, ...pos } satisfies TokenPos;
});

const blockCommentError = Parser.do(function* () {
  const src: string = yield Parser.substring();
  const pos: Position = yield Parser.span();
  const cause = SystemError.unclosedBlockComment(pos);
  const token = { type: "placeholder", src, ...pos } satisfies TokenPos;
  return { type: "error", cause, token, src, ...pos } satisfies TokenPos;
});

const number = function* (value: string) {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "number", value: Number(value), src, ...pos } satisfies TokenPos;
};

const newline = function* () {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "newline", src, ...pos } satisfies TokenPos;
};

const identifier = function* () {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "identifier", src, ...pos } satisfies TokenPos;
};

const placeholder = function* () {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "placeholder", src, ...pos } satisfies TokenPos;
};

const string = function* () {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "string", src, ...pos } satisfies TokenPos;
};

const multilineString = function* (intend: string) {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "multilineString", intend, src, ...pos } satisfies TokenPos;
};

const stringSegment = function* (value: string) {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "segment", value, src, ...pos } satisfies StringTokenPos;
};

const stringLastSegment = function* (value: string) {
  const pos: Position = yield Parser.span();
  const src: string = yield Parser.substring();
  return { type: "lastSegment", value, src, ...pos } satisfies StringTokenPos;
};

const stringLiteralError = function* (value: string) {
  const src: string = yield Parser.substring();
  const pos: Position = yield Parser.span();
  const cause = SystemError.unterminatedString(pos);
  return { type: "error", cause, value, src, ...pos } satisfies StringTokenPos;
};

const parseHexStyleLiteral = (prefix: string, digitRegexp: RegExp, error: Parser<string, TokenPos>) =>
  Parser.do(function* () {
    if (!(yield Parser.checkRegexp(digitRegexp))) {
      return yield error;
    }

    let value = prefix;
    while ((yield Parser.checkRegexp(digitRegexp)) || (yield Parser.checkString("_"))) {
      const prev = yield Parser.nextChar();
      if (prev !== "_") value += prev;
    }

    return yield* number(value);
  });

const parseBlockComment = function* self() {
  while (!(yield Parser.string("*/"))) {
    if (yield Parser.string("/*")) yield* self();
    else if (yield Parser.isEnd()) return yield blockCommentError;
    else yield Parser.advance();
  }
  return null;
};

export const parseStringToken = Parser.do<string, StringTokenPos>(function* () {
  yield Parser.rememberIndex();
  let value = "";

  while (true) {
    if (yield Parser.string('"')) return yield* stringLastSegment(value);
    if (yield Parser.string("\\(")) return yield* stringSegment(value);
    if (yield Parser.isEnd()) return yield* stringLiteralError(value);
    if (yield Parser.checkString("\n")) return yield* stringLiteralError(value);

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
});

export const parseMultilineStringToken = (intend: string) =>
  Parser.do<string, StringTokenPos>(function* () {
    yield Parser.rememberIndex();
    let value = "";

    while (true) {
      if (yield Parser.isEnd()) return yield* stringLiteralError(value.trimEnd());
      if (yield Parser.string('"""')) return yield* stringLastSegment(value.trimEnd());
      if (yield Parser.string("\\(")) return yield* stringSegment(value);

      if (yield Parser.string(intend)) {
        if (yield Parser.isEnd()) continue;
        value += "\n";
        continue;
      }

      // if intendation is not full, skip until the next character
      if (yield Parser.string("\n")) {
        if (yield Parser.isEnd()) continue;
        while ((yield Parser.checkRegexp(/\s/)) && !(yield Parser.checkString("\n"))) yield Parser.advance();
        value += "\n";
        continue;
      }

      if (yield Parser.string("\\")) {
        if (yield Parser.isEnd()) continue;

        // escape sequence
        type Char = keyof typeof specialStringCharTable | null;
        const char: Char = yield Parser.oneOfStrings(...specialStringChars);
        if (char) {
          value += specialStringCharTable[char];
          continue;
        }
      }

      value += yield Parser.nextChar();
    }
  });

export const parseToken = Parser.do<string, TokenPos | SkipTokenPos>(function* () {
  yield Parser.rememberIndex();
  let isNewline = false;

  // skip comments and whitespace
  while (true) {
    if (yield Parser.string("/*")) {
      const result = yield* parseBlockComment();
      if (result) return result;
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

  if (isNewline) return yield* newline();
  if (yield Parser.isEnd()) return { type: "skip", ...(yield Parser.span()) };

  yield Parser.rememberIndex();

  if (yield Parser.string('"""\n')) {
    let intend = "\n";
    while ((yield Parser.checkRegexp(/\s/)) && !(yield Parser.checkString("\n"))) intend += yield Parser.nextChar();

    return yield* multilineString(intend);
  }

  if (yield Parser.string('"')) return yield* string();

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

    return yield* number(value);
  }

  if (/\.\d/.test(yield Parser.peekSubstring(2))) {
    yield Parser.advance();
    let value = "0.";

    while (yield Parser.checkRegexp(/\d/)) {
      value += yield Parser.nextChar();
      while (yield Parser.string("_")) {}
    }

    return yield* number(value);
  }

  if (yield Parser.checkRegexp(/[a-zA-Z_]/)) {
    while (yield Parser.regexp(/\w/)) {}

    const ident = yield Parser.substring();
    if (/^_+$/.test(ident)) return yield* placeholder();
    return yield* identifier();
  }

  for (const symbol of symbols) {
    if (yield Parser.string(symbol)) return yield* identifier();
  }

  yield Parser.nextChar();
  return yield* identifier();
});
