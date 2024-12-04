import type { Position } from "../position";
import type { Token } from "./tokens";

enum TokenGroupKind {}

export type TokenGroup = Token | { type: "group"; kind: TokenGroupKind; tokens: TokenGroup[] };

export type TokenPos = TokenGroup & Position;
