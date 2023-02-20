import { TaggedUnion } from "./types.mjs";

export type Type = TaggedUnion<{
  void: {};
  unknown: {};
}>;
