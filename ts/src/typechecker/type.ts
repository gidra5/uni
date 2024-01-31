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
  if (!("type" in arg)) return { name: "function", children: [arg, func(...rest)], order: 1 };
  else
    return {
      name: "function",
      children: [arg.type, func(...rest)],
      argName: arg.name,
      implicit: arg.implicit,
      order: 1,
    };
};
export const value = (value: { kind: string; value: any }): Type => ({
  name: "value",
  children: [],
  order: 0,
  value,
});
export const bool = (): Type => ({ name: "bool", children: [], order: 1 });
export const int = (): Type => ({ name: "int", children: [], order: 1 });
export const float = (): Type => ({ name: "float", children: [], order: 1 });
export const string = (): Type => ({ name: "string", children: [], order: 1 });
export const unit = (): Type => ({ name: "unit", children: [], order: 1 });
export const unknown = (): Type => ({ name: "unknown", children: [], order: 1 });
export const voidType = (): Type => ({ name: "void", children: [], order: 1 });
export const type = (): Type => ({ name: "type", children: [], order: 2 });
export const index = (index: number, order = 0): Type => ({ name: "name", children: [], index, order });
export const name = (argName: string, order = 0): Type => ({ name: "name", children: [], argName, order });
export const nameIndex = (argName: string, index: number, order = 0): Type => ({
  name: "name",
  children: [],
  argName,
  index,
  order,
});
export const and = (...types: Type[]): Type => ({ name: "and", children: types, order: 1 });
export const or = (...types: Type[]): Type => ({ name: "or", children: types, order: 1 });
export const not = (type: Type): Type => ({ name: "not", children: [type], order: 1 });
export const placeholder = (): Type => ({ name: "placeholder", children: [], order: 1 });