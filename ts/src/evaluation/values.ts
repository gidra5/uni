import { evaluate } from "./index.js";
import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope.js";
import { TaskQueue } from "./taskQueue.js";
import { ChannelValue, ExprValue, FunctionValue, RecordValue, ValueRef, Value, Context, Continuation } from "./types";

export const isRecord = (value: Value): value is RecordValue =>
  !!value && typeof value === "object" && value.kind === "record";

export const recordSet =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value, value: Value): void => {
    if (key === null) return;

    if (value === null) {
      if (typeof key === "number") {
        tuple.splice(key, 1);
      } else if (typeof key === "symbol" && key.description) {
        delete record[key.description];
      } else {
        map.delete(key);
      }
      return;
    }

    if (typeof key === "number") {
      tuple[key] = value;
    } else if (typeof key === "symbol" || typeof key === "string") {
      record[key] = value;
    } else {
      map.set(key, value);
    }
  };

export const recordGet =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value): Value => {
    if (key === null) return null;

    if (typeof key === "number") return tuple[key] ?? null;
    if (typeof key === "symbol" || typeof key === "string") return record[key] ?? null;
    return map.get(key) ?? null;
  };

export const recordHas =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value): boolean => {
    if (key === null) return false;
    if (typeof key === "number") return key in tuple;
    if (typeof key === "symbol" || typeof key === "string") return key in record;
    return map.has(key);
  };

export const record = (
  taskQueue: TaskQueue,
  tuple: Value[] = [],
  record: Record<string | symbol, Value> = {},
  map: Map<Value, Value> = new Map()
): RecordValue => ({
  kind: "record",
  has: recordHas(tuple, record, map),
  get(key: Value) {
    const get = recordGet(tuple, record, map);
    const set = recordSet(tuple, record, map);
    return { get: () => get(key), set: (value) => set(key, value) };
  },
  tuple,
  record,
  map,
});

export const expr = (ast: AbstractSyntaxTree, scope: Scope<ValueRef>): ExprValue => ({
  kind: "expr",
  ast,
  scope,
});

export const macro =
  (fn: (arg: ExprValue) => Value): FunctionValue =>
  (exprVal, cont) =>
    cont(fn(exprVal));

export const fn =
  (context: Context, _fn: (arg: Value) => Value): FunctionValue =>
  (expr, cont) =>
    evaluate(context.taskQueue, expr.ast, { ...context, scope: expr.scope }, (arg) => cont(_fn(arg)));
export const fnWithCont =
  (context: Context, _fn: (arg: Value, continuation: Continuation) => void): FunctionValue =>
  (expr, cont) =>
    evaluate(context.taskQueue, expr.ast, { ...context, scope: expr.scope }, (arg) => _fn(arg, cont));

export const channel = (): ChannelValue => ({ kind: "channel", channel: Symbol("channel") });

export const immutableRef = (value: Value): Value => ({ get: () => value, kind: "ref" });
export const ref = (value: Value): Value => ({ get: () => value, set: (val) => (value = val), kind: "ref" });
