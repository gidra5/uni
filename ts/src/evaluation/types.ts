import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope";
import { TaskQueue } from "./taskQueue";

export type SymbolValue = symbol;
export type ChannelValue = { kind: "channel"; channel: symbol };
export type ScopeValue = { get?: () => Value; set?: (val: Value) => void };
export type ExprValue = {
  kind: "expr";
  ast: AbstractSyntaxTree;
  scope: Scope<ScopeValue>;
};
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
export type FunctionValue = (argChannel: ExprValue, continuation: Continuation) => void;
export type Value =
  | number
  | string
  | boolean
  | null
  | ExprValue
  | FunctionValue
  | RecordValue
  | SymbolValue
  | ChannelValue
  | TypeValue;

export type Continuation = (arg: Value) => void;
export type Context = { scope: Scope<ScopeValue>; continuation: Continuation };
export type Evaluate = (taskQueue: TaskQueue, ast: AbstractSyntaxTree, context: Context) => void;
