import { SystemError } from "../error";
import { indexPosition, intervalPosition, type Position } from "../position";
import {
  parseMultilineStringToken,
  parseStringToken,
  parseToken,
  parseWhitespace,
  type StringToken,
  type Token,
} from "./tokens";
import { Parser, BaseContext } from "./utils";

export enum TokenGroupKind {
  StringTemplate,
  Parentheses,
  Braces,
  Brackets,
}

export type TokenGroup =
  | ({ type: "placeholder" } & Position)
  | ({ type: "newline" } & Position)
  | ({ type: "identifier"; name: string } & Position)
  | ({ type: "number"; value: number } & Position)
  | ({ type: "string"; value: string } & Position)
  | ({ type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] } & Position)
  | { type: "error"; cause: SystemError; token: TokenGroup };

type ParserContext = { followSet: string[] } & BaseContext;

export const _parseToken: Parser<string, TokenGroup, ParserContext> = Parser.do(function* self() {
  yield Parser.rememberIndex();
  const token: Token = yield parseToken as any;

  if (token.type === "string" || token.type === "multilineString") {
    const parser = token.type === "string" ? parseStringToken : parseMultilineStringToken(token.intend);
    const start: number = yield Parser.rememberedIndex();
    const tokens: TokenGroup[] = [];

    while (true) {
      const segment: StringToken = yield parser;

      if (segment.type === "lastSegment") {
        tokens.push({ ...segment, type: "string" });
        break;
      }
      if (segment.type === "error") {
        const { cause, ...token } = segment;
        tokens.push({ type: "error", cause, token: { ...token, type: "string" } });
        break;
      }

      // opening "\(" token
      const openPos: Position = intervalPosition(segment.end - 2, 2);
      const { tokens: _tokens, closed }: TokenGroupResult = yield parseTokenGroup(")");
      const pos: Position = yield Parser.span(start);
      if (closed) {
        tokens.push({ type: "group", kind: TokenGroupKind.Parentheses, tokens: _tokens, ...pos });
      } else {
        const _token: TokenGroup = { type: "group", kind: TokenGroupKind.Parentheses, tokens, ...pos };
        const closeIndex: number = yield Parser.index();
        const closePos: Position = indexPosition(closeIndex);
        const cause = SystemError.unbalancedOpenToken(["\\(", ")"], openPos, closePos);

        tokens.push({ type: "error", cause, token: _token });
      }
    }

    const pos: Position = yield Parser.span(start);
    return { type: "group", kind: TokenGroupKind.StringTemplate, tokens, ...pos };
  }

  if (token.type === "identifier") {
    if (token.name === "(") {
      const start: number = yield Parser.rememberedIndex();
      const openPos: Position = yield Parser.span();
      const { tokens, closed }: TokenGroupResult = yield parseTokenGroup(")");
      const pos: Position = yield Parser.span(start);
      if (closed) return { type: "group", kind: TokenGroupKind.Parentheses, tokens, ...pos };

      const _token: TokenGroup = { type: "group", kind: TokenGroupKind.Parentheses, tokens, ...pos };
      const closeIndex: number = yield Parser.index();
      const closePos: Position = indexPosition(closeIndex);
      const cause = SystemError.unbalancedOpenToken(["(", ")"], openPos, closePos);
      return { type: "error", cause, token: _token };
    }
  }

  return token;
});

type TokenGroupResult = {
  tokens: TokenGroup[];
  closed: boolean;
};

const parseTokenGroup = (until: string): Parser<string, TokenGroupResult, ParserContext> =>
  Parser.do(function* self() {
    const tokens: TokenGroup[] = [];
    yield Parser.appendFollow(until);
    const ws: ({ type: "newline" } & Position) | null = yield parseWhitespace;
    if (ws) tokens.push(ws);
    while (!(yield Parser.checkFollowSet())) {
      const token: TokenGroup = yield _parseToken;
      tokens.push(token);
      const ws: ({ type: "newline" } & Position) | null = yield parseWhitespace as any;
      if (ws) tokens.push(ws);
    }
    yield Parser.popFollow();

    return { tokens, closed: yield Parser.string(until) };
  });

export const parseTokenGroups = _parseToken.all<string, TokenGroup>({ index: 0, followSet: [] });
