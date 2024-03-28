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
export type ScopeValue = { get?: () => Value; set?: (val: Value) => void };
export type Context = { scope: Scope<ScopeValue>; continuation?: (val: Value) => Value };

export type TaskQueueScopeValue = { get?: () => TaskQueueValue; set?: (val: TaskQueueValue) => void };
export type TaskQueueExprValue = {
  kind: "expr";
  ast: AbstractSyntaxTree;
  scope: Scope<TaskQueueScopeValue>;
  continuation?: symbol;
};
export type TaskQueueRecordValue = {
  kind: "record";
  get: (key: TaskQueueValue) => TaskQueueValue;
  set: (key: TaskQueueValue, val: TaskQueueValue) => void;
  has: (key: TaskQueueValue) => boolean;
  tuple: TaskQueueValue[];
  record: Record<string | symbol, TaskQueueValue>;
  map: Map<TaskQueueValue, TaskQueueValue>;
};
export type TaskQueueTypeValue = { kind: "type"; name: string; value: TaskQueueValue };
export type TaskQueueFunctionValue = (argChannel: symbol) => symbol;
export type TaskQueueValue =
  | number
  | string
  | boolean
  | null
  | TaskQueueExprValue
  | TaskQueueFunctionValue
  | TaskQueueRecordValue
  | SymbolValue
  | TaskQueueTypeValue;
export type TaskQueueContext = { scope: Scope<TaskQueueScopeValue>; continuation?: symbol };
