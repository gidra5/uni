import { Type } from "./types";

/* 
  func - function type
  bool - boolean type
  number - number type
  string - string type
  unit - unit type, can be constructed from "nothing"
  unknown - unknown type, allows any value to be assigned
  void - void type, value that cannot be used in any way
*/

export const func = (arg: Type, ret: Type): Type => ({
  kind: "function",
  types: [arg, ret],
});
export const bool = (): Type => ({ kind: "bool", types: [] });
export const number = (): Type => ({ kind: "number", types: [] });
export const string = (): Type => ({ kind: "string", types: [] });
export const unit = (): Type => ({ kind: "unit", types: [] });
export const unknown = (): Type => ({ kind: "unknown", types: [] });
export const voidType = (): Type => ({ kind: "void", types: [] });
