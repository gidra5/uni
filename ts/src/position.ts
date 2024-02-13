import { Position, TokenPos } from "./parser/types.js";
import { clamp } from "./utils/index.js";

export function position(start: number, end: number): Position {
  return { start, end };
}

export function intervalPosition(start: number, length: number): Position {
  return position(start, start + length);
}

export function indexPosition(pos: number): Position {
  return position(pos, pos);
}

export const tokenPosToSrcPos = (tokenPos: Position, tokens: TokenPos[]): Position => {
  const maxTokenPos = tokens.length - 1;
  const startToken = tokens[tokenPos.start] ?? tokens[maxTokenPos];
  const endToken = tokens[clamp(tokenPos.end - 1, tokenPos.start, maxTokenPos)];

  return position(startToken.pos.start, endToken.pos.end);
};
