import { SystemError } from "../error";
import { indexPosition, intervalPosition, type Position } from "../position";
import { assert, getPos, nextId, setPos } from "../utils";
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
  StringTemplate = "string template",
  Parentheses = "parentheses",
  Braces = "braces",
  Brackets = "brackets",
  ForIn = "for in",
  While = "while",
  Inject = "inject",
  Mask = "mask",
  Without = "without",
  Colon = "colon",
  Arrow = "arrow",
  If = "if",
  Match = "match",
  Record = "record",
  Dict = "dict",
  Function = "function",
}

export type TokenGroup = (
  | { type: "placeholder" }
  | { type: "newline" }
  | { type: "identifier"; name: string }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] }
  | { type: "group"; tokens: TokenGroup[] }
  | { type: "error"; cause: SystemError; token: TokenGroup }
) & { id: number };

type ParserContext = { followSet: string[] } & BaseContext;

const error = (cause: SystemError, token: TokenGroup): TokenGroup => ({ id: nextId(), type: "error", cause, token });
const group = function* (tokens: TokenGroup[], kind?: TokenGroupKind, start?: number) {
  const g = group3(tokens);
  if (kind === undefined) return g;
  return yield* group2(g, kind, start);
};
const group2 = function* (
  token: { id: number; type: "group"; tokens: TokenGroup[] },
  kind: TokenGroupKind,
  start?: number
) {
  setPos(token.id, yield Parser.span(start));
  return { ...token, kind } as TokenGroup;
};
const group3 = (tokens: TokenGroup[]) => {
  return { id: nextId(), type: "group", tokens } as { id: number; type: "group"; tokens: TokenGroup[] };
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
  const parsedWhitespace = yield parseWhitespace;
  if (parsedWhitespace) return parsedWhitespace;

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
        tokens.push({ id: nextId(), type: "error", cause, token: { ...token, type: "string" } });
        break;
      }

      assert(yield Parser.string("\\("));

      tokens.push({ ...segment, type: "string" });
      const start = getPos(segment.id)!.end;
      tokens.push(yield* parsePair(start, "\\(", ")", TokenGroupKind.Parentheses));
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
        yield parseTokenGroup("in", ":", "->", "{").chain(function* ({ tokens, closed }) {
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
          yield parseTokenGroup(":", "->", "{").chain(function* ({ tokens, closed }) {
            current = closed;
            if (["{", ":", "->"].includes(closed!)) return tokens;
            return error(yield* unbalancedOpenToken(start, "in", ':", "->" or "{') as any, tokens);
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

    if (token.name === "fn") {
      const start: number = yield Parser.rememberedIndex();
      const tokens: TokenGroup[] = [];
      let current: string | null = "fn";

      tokens.push(
        yield parseTokenGroup(":", "->", "{").chain(function* ({ tokens, closed }) {
          current = closed;
          if (["{", ":", "->"].includes(closed!)) return tokens;
          return error(yield* unbalancedOpenToken(start, "fn", "in") as any, tokens);
        })
      );

      if (!["{", ":", "->"].includes(current)) {
        const operandError = SystemError.missingOperand(indexPosition(yield Parser.index()));
        tokens.push(error(operandError, group3([])));
      } else if (current === "{") {
        tokens.push(yield* parseBraces());
      } else if (current === ":") {
        tokens.push(yield* group([], TokenGroupKind.Colon));
      } else if (current === "->") {
        const rememberedIndex = yield Parser.rememberIndex();
        const start: number = yield Parser.index();
        const x = yield parseTokenGroup("{").chain(function* ({ tokens, closed }) {
          current = closed;
          if (closed === "{") return tokens;
          return null;
        });
        if (!x) {
          yield Parser.resetIndex(start);
          yield Parser.rememberIndex(rememberedIndex);
          tokens.push(yield* group([], TokenGroupKind.Arrow));
        } else {
          tokens.push(x);
          tokens.push(yield* parseBraces());
        }
      }

      return yield* group(tokens, TokenGroupKind.Function, start);
    }

    if (["while", "inject", "mask", "without", "if"].includes(token.name)) {
      const start: number = yield Parser.rememberedIndex();
      const tokens: TokenGroup[] = [];
      let current: string | null = "for";

      tokens.push(
        yield parseTokenGroup(":", "->", "{").chain(function* ({ tokens, closed }) {
          current = closed;
          if (["{", ":", "->"].includes(closed!)) return tokens;
          return error(yield* unbalancedOpenToken(start, token.name, ':", "->" or "{') as any, tokens);
        })
      );

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

      return yield* group(tokens, token.name as TokenGroupKind, start);
    }

    if (token.name === "match") {
      const start: number = yield Parser.rememberedIndex();
      const tokens: TokenGroup[] = [];
      let current: string | null = "match";

      tokens.push(
        yield parseTokenGroup("{", "}").chain(function* ({ tokens, closed }) {
          current = closed;
          if (closed === "{") return tokens;
          return error(yield* unbalancedOpenToken(start, "match", "{") as any, tokens);
        })
      );

      if (current === "{") {
        tokens.push(yield* parseBraces());
      } else {
        const operandError = SystemError.missingOperand(indexPosition(yield Parser.index()));
        tokens.push(error(operandError, group3([])));
      }

      return yield* group(tokens, TokenGroupKind.Match, start);
    }
  }

  return token;
});

type TokenGroupResult = {
  tokens: { id: number; type: "group"; tokens: TokenGroup[] };
  closed: string | null;
};

export const parseTokenGroup = (...untils: string[]): Parser<string, TokenGroupResult, ParserContext> =>
  Parser.do(function* self() {
    const tokens: TokenGroup[] = [];

    for (const until of untils) yield Parser.appendFollow(until);
    yield parseWhitespace as any;

    while (!(yield Parser.checkFollowSet()) && (yield Parser.isNotEnd())) {
      const token: TokenGroup = yield _parseToken;
      tokens.push(token);
      const ws = yield parseWhitespace as any;
      if (ws && !(yield Parser.checkFollowSet())) tokens.push(ws);
    }

    for (const _until of untils) yield Parser.popFollow();

    return { tokens: group3(tokens), closed: yield Parser.oneOfStrings(...untils) };
  });

export const parseTokenGroups = _parseToken.all<string, TokenGroup>({ index: 0, followSet: [] });
