import { Token, Grammar } from "./Grammar";
export const keywords = new Set<string>();
export const literals: Map<string, Grammar> = new Map();
export const identifiers: Set<Token> = new Set();