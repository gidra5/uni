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

type FuncArg = { name?: string; type: Type; implicit?: boolean };
type FuncArguments = [...args: (Type | FuncArg)[], ret: Type];
export const func = (...args: FuncArguments): Type => {
  if (args.length === 1) return args[0] as Type;
  const [arg, ...rest] = args as [Type | FuncArg, ...FuncArguments];
  if (!("type" in arg)) return { kind: "function", types: [arg, func(...rest)], order: 1 };
  else return { kind: "function", types: [arg.type, func(...rest)], name: arg.name, implicit: arg.implicit, order: 1 };
};
export const value = (value: { kind: string; value: any }): Type => ({ kind: "value", types: [], order: 0, value });
export const bool = (): Type => ({ kind: "bool", types: [], order: 1 });
export const int = (): Type => ({ kind: "int", types: [], order: 1 });
export const float = (): Type => ({ kind: "float", types: [], order: 1 });
export const string = (): Type => ({ kind: "string", types: [], order: 1 });
export const unit = (): Type => ({ kind: "unit", types: [], order: 1 });
export const unknown = (): Type => ({ kind: "unknown", types: [], order: 1 });
export const voidType = (): Type => ({ kind: "void", types: [], order: 1 });
export const type = (): Type => ({ kind: "type", types: [], order: 2 });
export const index = (index: number, order = 0): Type => ({ kind: "name", types: [], index, order });
export const name = (name: string, order = 0): Type => ({ kind: "name", types: [], name, order });
export const nameIndex = (name: string, index: number, order = 0): Type => ({
  kind: "name",
  types: [],
  name,
  index,
  order,
});
export const and = (...types: Type[]): Type => ({ kind: "and", types, order: 1 });
export const or = (...types: Type[]): Type => ({ kind: "or", types, order: 1 });
export const not = (type: Type): Type => ({ kind: "not", types: [type], order: 1 });