import { assert } from "./utils/index.js";

export type Tagged<Type, T, TypeKey extends string = "type"> = {
  [k in TypeKey]: Type;
} & T;
export type TaggedItem<Type, T, TypeKey extends string = "type", ItemKey extends string = "item"> = {
  [k in TypeKey]: Type;
} & { [k in ItemKey]: T };

/**
 * Generates tagged union (`{ type: T } & TypeMap[T]` for every `T in keyof TypeMap`) from a map of types `TypeMap`
 */
export type TaggedUnion<
  TypeMap extends Record<string, unknown>,
  TypeKey extends string = "type",
  U extends keyof TypeMap = keyof TypeMap
> = U extends unknown ? Tagged<U, TypeMap[U], TypeKey> : never;

/**
 * Generates tagged union (`{ type: T } & TypeMap[T]` for every `T in keyof TypeMap`) from a map of types `TypeMap`
 */
export type TaggedItemUnion<
  TypeMap extends Record<string, unknown>,
  TypeKey extends string = "type",
  ItemKey extends string = "item",
  U extends keyof TypeMap = keyof TypeMap
> = U extends unknown ? TaggedItem<U, TypeMap[U], TypeKey, ItemKey> : never;

export type Expand<T> = T extends (...args: infer A) => infer R
  ? (...args: Expand<A>) => Expand<R>
  : T extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
  ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
  : T extends object
  ? T extends infer O
    ? { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T;

export type TupleN<N extends number, T = unknown, A extends unknown[] = []> = number extends N
  ? T[]
  : A["length"] extends N
  ? A
  : TupleN<N, T, [...A, T]>;
export type Sum<A extends number, B extends number> = [...TupleN<A>, ...TupleN<B>]["length"];
export type Succ<A extends number> = Sum<A, 1>;
export type Pred<A extends number> = TupleN<A> extends [...infer B, infer _] ? B["length"] : A;
export type Sub<A extends number, B extends number> = B extends 0
  ? A
  : number extends B
  ? number
  : Sub<Pred<A>, Pred<B>>;

export type Option<T> = TaggedUnion<{ some: { value: T }; none: {} }>;
export const some = <T>(value: T): Option<T> => ({ type: "some", value });
export const none = <T>(): Option<T> => ({ type: "none" });
export const unwrapSome = <T>(x: Option<T>): T => {
  assert(x.type === "some", 'Option was not "some" variant');
  return x.value;
};
export type Result<T, E> = TaggedUnion<{ ok: { value: T }; err: { err: E } }>;
export const ok = <T, E>(value: T): Result<T, E> => ({ type: "ok", value });
export const err = <T, E>(err: E): Result<T, E> => ({ type: "err", err });
export const unwrapOk = <T, E>(x: Result<T, E>): T => {
  assert(x.type === "ok", 'Result was not "ok" variant');
  return x.value;
};
export const unwrapErr = <T, E>(x: Result<T, E>): E => {
  assert(x.type === "err", 'Result was not "err" variant');
  return x.err;
};

export type Context<T = any> = Record<string, T>;

export type RecordKey = string | number | symbol;
export type RecordEntry = [RecordKey, unknown];
export type IteratorInterface<T, TReturn = any, TNext = unknown> = Iterator<T, TReturn, TNext>;
