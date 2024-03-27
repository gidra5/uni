import { evaluate } from ".";
import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope";
import { ExprValue, FunctionValue, RecordValue, ScopeValue, Value } from "./types";

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
  tuple: Value[] = [],
  record: { [key: string]: Value } = {},
  map: Map<Value, Value> = new Map()
): RecordValue => ({
  kind: "record",
  has: recordHas(tuple, record, map),
  get(key: Value) {
    const getter = recordGet(tuple, record, map);
    if (key === getterSymbol) return fn(this.get);
    if (key === setterSymbol) return fn((k) => fn((v) => (this.set(k, v), null)));
    return getter(key);
  },
  set: recordSet(tuple, record, map),
  tuple,
  record,
  map,
});
export const expr = (
  ast: AbstractSyntaxTree,
  scope: Scope<ScopeValue>,
  continuation?: (val: Value) => Value
): ExprValue => ({
  kind: "expr",
  ast,
  scope,
  continuation,
});
export const fn =
  <T extends Value>(value: (arg: T) => Value): FunctionValue =>
  (arg) =>
    evaluate(arg.ast, { scope: arg.scope, continuation: value as any });

export const getterSymbol = Symbol();
export const setterSymbol = Symbol();
