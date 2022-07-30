import { Pattern } from "./parser.mjs";
import { TaggedItemUnion } from "./types.mjs";

export type Type = TaggedItemUnion<{
  define: { pattern: Pattern, valueType: Type },
}>;