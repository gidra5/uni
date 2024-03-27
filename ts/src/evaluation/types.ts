import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope";
import { TaskQueue } from "./taskQueue";

export type SymbolValue = symbol;
export type RecordValue = {
  kind: "record";
  get: (key: Value) => Value;
  set: (key: Value, val: Value) => void;
  has: (key: Value) => boolean;
  tuple: Value[];
  record: Record<string | symbol, Value>;
  map: Map<Value, Value>;
};
export type TypeValue = { kind: "type"; name: string; value: Value };
export type ExprValue = {
  kind: "expr";
  ast: AbstractSyntaxTree;
  scope: Scope<ScopeValue>;
  continuation?: (val: Value) => Value;
};
export type FunctionValue = (arg: ExprValue) => Value;
export type Value = number | string | boolean | null | FunctionValue | RecordValue | SymbolValue | TypeValue;
export type ScopeValue = { get?: () => Value; set?: (val: Value) => void; type?: TypeValue };
// export type Context = { scope: Scope<ScopeValue>; continuation?: (val: Value) => Value; taskQueue: TaskQueue };
export type Context = { scope: Scope<ScopeValue>; continuation?: (val: Value) => Value };
