import type { SystemError } from "../error";
import type { Position } from "../position";
import {
  parseMultilineStringToken,
  parseStringToken,
  parseToken,
  parseWhitespace,
  type StringTokenPos,
  type TokenPos,
} from "./tokens";
import { Parser, BaseContext } from "./utils";

enum TokenGroupKind {
  StringInterpolation,
  Parentheses,
  Braces,
  Brackets,
}

export type TokenGroup =
  | ({ type: "placeholder" | "newline" } & Position)
  | ({ type: "identifier"; name: string } & Position)
  | ({ type: "number"; value: number } & Position)
  | ({ type: "string"; value: string } & Position)
  | ({ type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] } & Position)
  | { type: "error"; cause: SystemError; token: TokenGroup };

type ParserContext = {
  followSet: string[];
} & BaseContext;

const _parseToken = Parser.do<string, TokenGroup, ParserContext>(function* self() {
  yield Parser.rememberIndex();
  const token: TokenPos = yield parseToken;

  if (token.type === "multilineString") {
    const parser = parseMultilineStringToken(token.intend);
    const tokens: TokenGroup[] = [];

    while (true) {
      yield Parser.rememberIndex();
      const segment: StringTokenPos = yield parser;

      if (segment.type === "lastSegment") {
        tokens.push({ ...segment, type: "string" });
        break;
      }
      if (segment.type === "error") {
        const { cause, ...token } = segment;
        tokens.push({ type: "error", cause, token: { ...token, type: "string" } });
        break;
      }

      const _tokens: TokenGroup[] = yield parseTokenGroup(")");
      const pos: Position = yield Parser.span();
      tokens.push({ type: "group", kind: TokenGroupKind.StringInterpolation, tokens: _tokens, ...pos });
    }

    return { type: "group", kind: TokenGroupKind.StringInterpolation, tokens };
  }

  if (token.type === "string") {
    const tokens: TokenGroup[] = [];

    while (true) {
      yield Parser.rememberIndex();
      const segment: StringTokenPos = yield parseStringToken;

      if (segment.type === "lastSegment") {
        tokens.push({ ...segment, type: "string" });
        break;
      }
      if (segment.type === "error") {
        const { cause, ...token } = segment;
        tokens.push({ type: "error", cause, token: { ...token, type: "string" } });
        break;
      }

      const _tokens: TokenGroup[] = yield parseTokenGroup(")");
      const pos: Position = yield Parser.span();
      tokens.push({ type: "group", kind: TokenGroupKind.StringInterpolation, tokens: _tokens, ...pos });
    }

    return { type: "group", kind: TokenGroupKind.StringInterpolation, tokens };
  }

  if (token.type === "identifier") {
    if (token.name === "(") {
      const tokens: TokenGroup[] = yield parseTokenGroup(")");
      const pos: Position = yield Parser.span();
      return { type: "group", kind: TokenGroupKind.Parentheses, tokens, ...pos };
    }
  }

  return token;
});

const parseTokenGroup = (until: string) =>
  Parser.do<string, TokenGroup[], ParserContext>(function* self() {
    const tokens: TokenGroup[] = [];
    yield Parser.appendFollow(until);
    const ws = yield parseWhitespace;
    if (ws) tokens.push(ws);
    while (!(yield Parser.checkFollowSet())) {
      const token = yield _parseToken;
      tokens.push(token);
      const ws = yield parseWhitespace;
      if (ws) tokens.push(ws);
    }
    yield Parser.popFollow();

    return tokens;
  });

export const parseTokenGroups = _parseToken.all({ index: 0, followSet: [] });
