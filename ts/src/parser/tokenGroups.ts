import type { SystemError } from "../error";
import type { Position } from "../position";
import { parseStringToken, parseToken, type StringTokenPos, type TokenPos } from "./tokens";
import { Parser, BaseContext } from "./utils";

enum TokenGroupKind {
  StringInterpolation,
  Parentheses,
  Braces,
  Brackets,
}

export type TokenGroup =
  | { type: "placeholder"; src: string }
  | { type: "identifier" | "newline"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string; string: number }
  | { type: "error"; cause: SystemError; token: TokenGroup }
  | { type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] };

export type TokenGroupPos = TokenGroup & Position;

type ParserContext = {
  followSet: string[];
} & BaseContext;

const parseTokenGroup = Parser.do<string, TokenGroupPos, ParserContext>(function* self() {
  const token: TokenPos = yield parseToken;

  if (token.type === "multilineString") {
    const segment: StringTokenPos = yield parseStringToken;

    if (segment.type === "segment") {
      yield Parser.appendFollow(")");

      const tokenGroup = yield parseTokenGroup;

      yield Parser.popFollow();
    }
  }
  if (token.type === "string") {
  }

  return token;
});

export const parseTokenGroups = parseTokenGroup.all({ index: 0, followSet: [] });
