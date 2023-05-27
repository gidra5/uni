import { TaggedUnion } from "./types.js";

export type Type = TaggedUnion<{
  void: {};
  unknown: {};
}>;
