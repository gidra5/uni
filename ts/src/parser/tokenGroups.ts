import { SystemError } from "../error";
import { indexPosition, intervalPosition, type Position } from "../position";
import { assert } from "../utils";
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
  ForIn,
  Colon,
  Arrow,
}

export type TokenGroup =
  | ({ type: "placeholder" } & Position)
  | ({ type: "newline" } & Position)
  | ({ type: "identifier"; name: string } & Position)
  | ({ type: "number"; value: number } & Position)
  | ({ type: "string"; value: string } & Position)
  | ({ type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] } & Position)
  | { type: "group"; tokens: TokenGroup[] }
  | { type: "error"; cause: SystemError; token: TokenGroup };

type ParserContext = { followSet: string[] } & BaseContext;

const error = (cause: SystemError, token: TokenGroup): TokenGroup => ({ type: "error", cause, token });
const group = function* (tokens: TokenGroup[], kind?: TokenGroupKind, start?: number) {
  if (kind !== undefined) {
    const pos = yield Parser.span(start);
    return { type: "group", kind, tokens, ...pos } as TokenGroup;
  }
  return { type: "group", tokens } as TokenGroup;
};
const group2 = function* (token: { type: "group"; tokens: TokenGroup[] }, kind: TokenGroupKind, start: number) {
  const pos = yield Parser.span(start);
  return { ...token, kind, ...pos } as TokenGroup;
};
const group3 = (tokens: TokenGroup[]) => {
  return { type: "group", tokens } as { type: "group"; tokens: TokenGroup[] };
};
const unbalancedOpenToken = function* (start: number, startStr: string, endStr: string) {
  const openPos: Position = intervalPosition(start, startStr.length);
  const closePos: Position = indexPosition(yield Parser.index());
  return SystemError.unbalancedOpenToken([startStr, endStr], openPos, closePos);
};

const parsePair = function* self(start: number, startStr: string, endStr: string, kind: TokenGroupKind) {
  const { tokens, closed }: TokenGroupResult = yield parseTokenGroup(endStr);
  const _token: TokenGroup = yield* group2(tokens, kind, start);
  if (closed) return _token;

  return error(yield* unbalancedOpenToken(start, startStr, endStr), _token);
};

const parseBraces = function* self() {
  const start: number = yield Parser.rememberedIndex();
  return yield* parsePair(start, "{", "}", TokenGroupKind.Braces);
};

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
        assert(yield Parser.string(token.type === "string" ? '"' : '"""'));
        tokens.push({ ...segment, type: "string" });
        break;
      }

      if (segment.type === "error") {
        const { cause, ...token } = segment;
        tokens.push({ type: "error", cause, token: { ...token, type: "string" } });
        break;
      }

      assert(yield Parser.string("\\("));

      tokens.push({ ...segment, type: "string" });
      tokens.push(yield* parsePair(segment.end, "\\(", ")", TokenGroupKind.Parentheses));
    }

    return yield* group(tokens, TokenGroupKind.StringTemplate, start);
  }

  if (token.type === "identifier") {
    if (token.name === "(") {
      const start: number = yield Parser.rememberedIndex();
      return yield* parsePair(start, "(", ")", TokenGroupKind.Parentheses);
    }
    if (token.name === "[") {
      const start: number = yield Parser.rememberedIndex();
      return yield* parsePair(start, "[", "]", TokenGroupKind.Brackets);
    }
    if (token.name === "{") return yield* parseBraces();

    if (token.name === "for") {
      const start: number = yield Parser.rememberedIndex();
      const tokens: TokenGroup[] = [];
      let current: string | null = "for";

      tokens.push(
        yield parseTokenGroup("in", ":", "->", "{", "}").chain(function* ({ tokens, closed }) {
          current = closed;
          if (closed === "in") return tokens;
          return error(yield* unbalancedOpenToken(start, "for", "in") as any, tokens);
        })
      );

      if (current !== "in") {
        const operandError = SystemError.missingOperand(indexPosition(yield Parser.index()));
        tokens.push(error(operandError, group3([])));
      } else {
        tokens.push(
          yield parseTokenGroup(":", "->", "{", "}").chain(function* ({ tokens, closed }) {
            current = closed;
            if (closed === "in") return tokens;
            return error(yield* unbalancedOpenToken(start, "for", "in") as any, tokens);
          })
        );
      }

      if (!["{", ":", "->"].includes(current)) {
        const operandError = SystemError.missingOperand(indexPosition(yield Parser.index()));
        tokens.push(error(operandError, group3([])));
      } else if (current === "{") {
        tokens.push(yield* parseBraces());
      } else if (current === ":") {
        tokens.push(yield* group([], TokenGroupKind.Colon));
      } else if (current === "->") {
        tokens.push(yield* group([], TokenGroupKind.Arrow));
      }

      return yield* group(tokens, TokenGroupKind.ForIn, start);
    }
  }

  return token;
});

type TokenGroupResult = {
  tokens: { type: "group"; tokens: TokenGroup[] };
  closed: string | null;
};

export const parseTokenGroup = (...untils: string[]): Parser<string, TokenGroupResult, ParserContext> =>
  Parser.do(function* self() {
    const tokens: TokenGroup[] = [];

    for (const until of untils) yield Parser.appendFollow(until);
    const ws: ({ type: "newline" } & Position) | null = yield parseWhitespace;
    if (ws) tokens.push(ws);
    while (!(yield Parser.checkFollowSet()) && (yield Parser.isNotEnd())) {
      const token: TokenGroup = yield _parseToken;
      tokens.push(token);
      const ws: ({ type: "newline" } & Position) | null = yield parseWhitespace as any;
      if (ws) tokens.push(ws);
    }
    for (const _until of untils) yield Parser.popFollow();

    return { tokens: group3(tokens), closed: yield Parser.oneOfStrings(...untils) };
  });

export const parseTokenGroups = _parseToken.all<string, TokenGroup>({ index: 0, followSet: [] });
