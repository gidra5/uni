import { Iterator } from "iterator-js";

export const CopySymbol = Symbol("Copy");

export type Copyable<T> = {
  [CopySymbol]: () => T;
};

export const copy = <T>(x: T | Copyable<T>): T => {
  if (!x) return x;
  if (typeof x === "number") return x;
  if (typeof x === "string") return x;
  if (typeof x === "boolean") return x;
  if (typeof x === "bigint") return x;
  if (Array.isArray(x)) return x.map(copy) as T;

  if (typeof (x as any)[CopySymbol] === "function") {
    return (x as any)[CopySymbol]();
  }

  return Iterator.iterEntries(x as any)
    .map(([k, v]) => [k, copy(v)] as [string, any])
    .toObject() as T;
};
