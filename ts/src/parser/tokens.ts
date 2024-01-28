import { endOfSrcError, error } from "../errors.js";
import type { ParsingError, StringParser, Token, TokenPos } from "./types.js";
import {
  indexPosition,
  position as _position,
  intervalPosition,
} from "../position.js";
import { Iterator } from "iterator-js";

type TokenConstructorArgs<T> = T extends "identifier" | "newline"
  ? [src: Token["src"], pos: TokenPos["pos"]]
  : T extends "number"
  ? [src: Token["src"], pos: TokenPos["pos"], value: number]
  : [src: Token["src"], pos: TokenPos["pos"], value: string];

export const token =
  <T extends Token["type"]>(type: T) =>
  (...[src, pos, value]: TokenConstructorArgs<T>) =>
    ({ type, src, value, pos } as TokenPos);

export const identifier = token("identifier");
export const number = token("number");
export const string = token("string");
export const newline = token("newline");

const symbols = Iterator.iter(["->", "--", "++", "//", "/*", "*/", "!=", "==", ">=", "<=", ":=", "===", "!==", "..."]);

export const parseToken: StringParser<TokenPos> = (src, i = 0) => {
  let index = i;
  const errors: ParsingError[] = [];

  if (!src.charAt(index)) {
    errors.push(endOfSrcError(index));
    return [index, newline("", indexPosition(index)), errors];
  }
  const tokenSrc = (start: number) => src.substring(start, index);
  const position = (start: number) => _position(start, index);

  while (/\s/.test(src.charAt(index))) index++;
  if (tokenSrc(i).includes("\n")) {
    return [index, newline(tokenSrc(i), position(i)), errors];
  }

  if (src.charAt(index) === '"') {
    const start = index;
    index++;

    let value = "";
    while (src.charAt(index) !== '"') {
      if (src.charAt(index) === "\\") index++;

      if (!src.charAt(index)) {
        const pos = intervalPosition(start, index);
        const errors = [endOfSrcError(index)];
        errors.push(error(`unterminated string`, pos, errors));
        break;
      }

      value += src.charAt(index);
      index++;
    }
    index++;

    return [index, string(tokenSrc(start), position(start), value), errors];
  }

  if (/\d/.test(src.charAt(index))) {
    const start = index;

    let value = "";
    while (/[_\d]/.test(src.charAt(index))) {
      while (src.charAt(index) === "_") {
        index++;
      }
      value += src.charAt(index);
      index++;
    }
    if (src.charAt(index) === ".") value += src.charAt(index++);
    if (/\d/.test(src.charAt(index))) {
      value += src.charAt(index);
      index++;
      while (/[_\d]/.test(src.charAt(index))) {
        while (src.charAt(index) === "_") {
          index++;
        }
        value += src.charAt(index);
        index++;
      }
    }

    const token = number(tokenSrc(start), position(start), Number(value));
    return [index, token, errors];
  }

  if (/[a-zA-Z_]/.test(src.charAt(index))) {
    const start = index;
    while (/\w/.test(src.charAt(index))) index++;

    return [index, identifier(tokenSrc(start), position(start)), errors];
  }

  if (src.charAt(index) === "." && /\d/.test(src.charAt(index + 1))) {
    const start = index;
    index++;
    let value = "0.";
    while (/[_\d]/.test(src.charAt(index))) {
      while (src.charAt(index) === "_") {
        index++;
      }
      value += src.charAt(index);
      index++;
    }

    const token = number(tokenSrc(start), position(start), Number(value));
    return [index, token, errors];
  }

  const start = index;
  const _src =
    symbols
      .filter((symbol) => src.startsWith(symbol, start))
      .reduce((a, b) => (a.length > b.length ? a : b), "") || src.charAt(index);
  index += _src.length;

  return [index, identifier(_src, position(start)), errors];
};

export const parseTokens: StringParser<TokenPos[], true> = (src, i = 0) => {
  let index = i;
  const errors: ParsingError[] = [];
  const tokens: TokenPos[] = [];

  while (src.charAt(index)) {
    const [nextIndex, token, _errors] = parseToken(src, index);

    index = nextIndex;
    tokens.push(token);
    errors.push(..._errors);
  }

  return [tokens, errors];
};
