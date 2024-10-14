import { Iterator } from "iterator-js";
import { RecordKey } from "../types.js";

export const identity = <T>(x: T): T => x;

export const print = <T>(x: T): T => (console.dir(x, { depth: null }), x);

export function assert(condition: any, msg?: string): asserts condition {
  if (condition) return;
  throw new Error(msg ? `Assertion failed: ${msg}` : "Assertion failed");
}

export const omit = <T extends {}, K extends string>(obj: T, keys: K[]): Omit<T, K> => {
  return Iterator.iterEntries(obj)
    .filter(([key]) => !keys.includes(key as unknown as K))
    .toObject() as Omit<T, K>;
};

export const pick = <T extends {}, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key as K))) as Pick<T, K>;
};

export const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

export const isEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !isEqual(value, b.get(key))) return false;
    }
    return true;
  }

  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const key in a) {
    if (!(key in b)) return false;
    if (!isEqual(a[key], b[key])) return false;
  }

  return true;
};

export const mapField = (path: RecordKey[], fn: (x: any) => any) => (obj: any) => {
  const [head, ...tail] = path;
  if (Array.isArray(obj) && typeof head !== "symbol") {
    const index = Number(head);
    if (isNaN(index)) return obj;

    const prefix = obj.slice(0, index);
    const suffix = obj.slice(index + 1);
    if (tail.length === 0) return [...prefix, fn(obj[index]), ...suffix];
    return [...prefix, mapField(tail, fn)(obj[index]), ...suffix];
  }

  if (tail.length === 0) return { ...obj, [head]: fn(obj[head]) };
  return { ...obj, [head]: mapField(tail, fn)(obj[head]) };
};

export const setField = (path: RecordKey[], value: any) => mapField(path, () => value);

export const pushField = (path: RecordKey[], value: any) => mapField(path, (x) => x && [...x, value]);
