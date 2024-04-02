import { evaluate } from "./index.js";
import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope.js";
import { TaskQueue } from "./taskQueue.js";
import { ChannelValue, ExprValue, FunctionValue, RecordValue, ScopeValue, Value } from "./types";

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
    const getter = recordGet(tuple, record, map);
    if (key === getterSymbol) return fn(taskQueue, this.get);
    if (key === setterSymbol) return fn(taskQueue, (k) => fn(taskQueue, (v) => (this.set(k, v), null)));
    return getter(key);
  },
  set: recordSet(tuple, record, map),
  tuple,
  record,
  map,
});

export const expr = (ast: AbstractSyntaxTree, scope: Scope<ScopeValue>): ExprValue => ({
  kind: "expr",
  ast,
  scope,
});

export const macro =
  (fn: (arg: ExprValue) => Value): FunctionValue =>
  (exprVal, cont) =>
    cont(fn(exprVal));

export const fn =
  (taskQueue: TaskQueue, value: (arg: Value) => Value): FunctionValue =>
  (expr, cont) =>
    evaluate(taskQueue, expr.ast, {
      scope: expr.scope,
      continuation: (arg) => cont(value(arg)),
    });

export const channel = (): ChannelValue => ({ kind: "channel", channel: Symbol("channel") });

export const getterSymbol = Symbol();
export const setterSymbol = Symbol();
export const closedSymbol = Symbol();
