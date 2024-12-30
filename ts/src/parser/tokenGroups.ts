import { SystemError } from "../error.js";
import { indexPosition, intervalPosition, type Position } from "../utils/position.js";
import { assert, getPos, nextId, setPos } from "../utils/index.js";
import {
  parseMultilineStringToken,
  parseStringToken,
  parseToken,
  parseWhitespace,
  type StringToken,
  type Token,
} from "./tokens.js";
import { Parser, BaseContext } from "./utils.js";

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
  Function = "fn",
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
const unbalancedCloseToken = function* (startStr: string, endStr: string) {
  const closePos: Position = indexPosition(yield Parser.index());
  return SystemError.unbalancedCloseToken([startStr, endStr], closePos);
};

const parsePair = function* self(start: number, startStr: string, endStr: string, kind: TokenGroupKind) {
  const { tokens, closed }: TokenGroupResult = yield Parser.scope(
    { followSet: (yield Parser.followSet()).filter((x: string) => [")", "]", "}"].includes(x)) },
    function* () {
      return yield parseTokenGroup(endStr);
    }
  );
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
    if (!(yield Parser.checkFollowSetPrev())) {
      if (token.name === ")") {
        return error(yield* unbalancedCloseToken("(", ")"), token);
      }
      if (token.name === "]") {
        return error(yield* unbalancedCloseToken("[", "]"), token);
      }
      if (token.name === "}") {
        return error(yield* unbalancedCloseToken("{", "}"), token);
      }
    }

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
          if (closed === "}") {
            yield Parser.advance(-1);
            return error(yield* unbalancedOpenToken(start, "in", ':", "->" or "{') as any, tokens);
          }
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
            if (closed === "}") {
              yield Parser.advance(-1);
              return error(yield* unbalancedOpenToken(start, "in", ':", "->" or "{') as any, tokens);
            }
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

    if (["while", "inject", "mask", "without", "if", "fn"].includes(token.name)) {
      const start: number = yield Parser.rememberedIndex();
      const tokens: TokenGroup[] = [];
      let current: string | null = "start";

      tokens.push(
        yield parseTokenGroup(":", "->", "{", "}").chain(function* ({ tokens, closed }) {
          if (closed === "}") {
            yield Parser.advance(-1);
            return error(yield* unbalancedOpenToken(start, token.name, ':", "->" or "{') as any, tokens);
          }
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
          if (closed === "}") {
            yield Parser.advance(-1);
            return error(yield* unbalancedOpenToken(start, "match", "{") as any, tokens);
          }
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

    if (token.name === "record") {
      const start: number = yield Parser.rememberedIndex();
      yield Parser.rememberIndex();
      const token2: Token = yield parseToken as any;

      if (token2.type === "identifier" && token2.name === "{") {
        const g: TokenGroup & { type: "group" } = yield* parseBraces();
        return yield* group(g.tokens, TokenGroupKind.Record, start);
      }
      yield Parser.resetIndex();
      return error(SystemError.unknown(), token);
    }
  }

  return token;
});

type TokenGroupResult = {
  tokens: { id: number; type: "group"; tokens: TokenGroup[] };
  closed: string | null;
};

export const parseTokenGroup = (...untilArray: string[]): Parser<string, TokenGroupResult, ParserContext> =>
  Parser.do(function* self() {
    const tokens: TokenGroup[] = [];

    yield Parser.appendFollow(...untilArray);
    yield parseWhitespace as any;

    while (!(yield Parser.checkFollowSet()) && (yield Parser.isNotEnd())) {
      const token: TokenGroup = yield _parseToken;
      tokens.push(token);
      const ws = yield parseWhitespace as any;
      if (ws && !(yield Parser.checkFollowSet())) tokens.push(ws);
    }

    for (const _until of untilArray) yield Parser.popFollow();

    return { tokens: group3(tokens), closed: yield Parser.oneOfStrings(...untilArray) };
  });

export const parseTokenGroups = _parseToken.all<string, TokenGroup>({ index: 0, followSet: [] });
