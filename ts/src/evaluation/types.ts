import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope";
import { TaskQueue } from "./taskQueue";

export type SymbolValue = symbol;
export type ChannelValue = { kind: "channel"; channel: symbol };
export type ImmutableValueRef = { get: () => Value };
export type MutableValueRef = { get: () => Value; set: (val: Value) => void };
export type ValueRef = MutableValueRef | ImmutableValueRef;
export type ExprValue = {
  kind: "expr";
  ast: AbstractSyntaxTree;
  scope: Scope<ValueRef>;
};
export type RecordValue = {
  kind: "record";
  get: (key: Value) => ValueRef;
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
  | (ValueRef & { kind: "ref" })
  | TypeValue;

export type Continuation = (arg: Value) => void;
export type ResolvedModule = { ast: AbstractSyntaxTree } | { value: Value };
export type Context = {
  scope: Scope<ValueRef>;
  filePath: string;
  projectPath: string;
  dependencyResolver: (path: string) => Promise<ResolvedModule>;
};
export type Evaluate = (
  taskQueue: TaskQueue,
  ast: AbstractSyntaxTree,
  context: Context,
  continuation: Continuation
) => void;
