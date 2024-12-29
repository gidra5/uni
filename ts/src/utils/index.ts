import { Iterator } from "iterator-js";
import { RecordKey } from "../types.js";
import { setTimeout } from "node:timers/promises";
import { SystemError } from "../error.js";
import { inject, Injectable, register } from "./injector.js";
import type { Position } from "../utils/position.js";

export const identity = <T>(x: T): T => x;

export const dir = <T>(x: T): T => (console.dir(x, { depth: null }), x);

let eventLoopYieldCounter = 0;
const eventLoopYieldMax = 1000;
export const eventLoopYield = async () => {
  eventLoopYieldCounter = (eventLoopYieldCounter + 1) % eventLoopYieldMax;
  if (eventLoopYieldCounter === 0) await setTimeout(0);
};

export const nextId = () => {
  const id = inject(Injectable.NextId);
  register(Injectable.NextId, id + 1);
  return id;
};

export const setPos = (id: number, pos: Position) => inject(Injectable.PositionMap).set(id, pos);
export const getPos = (id: number) => inject(Injectable.PositionMap).get(id);

export function assert(condition: any, msg?: string | SystemError): asserts condition {
  if (condition) return;
  if (!msg) throw new Error("Assertion failed");
  if (msg instanceof SystemError) {
    msg.print();
    throw msg;
  }
  throw new Error(`Assertion failed: ${msg}`);
}

export function unreachable(msg?: string | SystemError): never {
  if (!msg) throw new Error("Unreachable");
  if (msg instanceof SystemError) {
    msg.print();
    throw msg;
  }
  throw new Error(msg);
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

export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, any>();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
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
