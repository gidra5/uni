import { RecordEntry } from "./types";

export class Iterator<T> {
  constructor(private generator: () => Generator<T>) {}

  [Symbol.iterator]() {
    return this.generator();
  }

  cached() {
    const it = this;
    let cache: T[] | null = null;
    const gen = function* () {
      if (cache) yield* cache;

      cache = [];
      for (const item of it) {
        cache.push(item);
        yield item;
      }
    };
    return new Iterator(gen);
  }

  reduce<U>(reducer: (acc: U, input: T) => U, initial: U) {
    const it = this;
    let acc = initial;
    for (const item1 of it) {
      acc = reducer(acc, item1);
    }
    return acc;
  }

  groupBy<U>(group: (input: Generator<T>) => Generator<U>) {
    const it = this;
    return new Iterator(() => group(it.generator()));
  }

  product<U>(gen2: Iterable<U>) {
    const it = this;
    const gen = function* () {
      const it2 = Iterator.iter(gen2).cached();
      for (const item1 of it) {
        for (const item2 of it2) yield [item1, item2] as [T, U];
      }
    };
    return new Iterator(gen);
  }

  filter(pred: (x: T) => boolean): Iterator<T>;
  filter<U extends T>(pred: (x: T) => x is U) {
    const it = this;
    const gen = function* () {
      for (const item of it) if (pred(item)) yield item;
    };
    return new Iterator(gen);
  }

  map<U>(map: (x: T) => U) {
    const it = this;
    const gen = function* () {
      for (const item of it) yield map(item);
    };
    return new Iterator(gen);
  }

  filterMap<U>(map: (x: T) => { pred: false } | { pred: true; value: U }) {
    const it = this;
    const gen = function* () {
      for (const item of it) {
        const result = map(item);
        if (result.pred) yield result.value;
      }
    };
    return new Iterator(gen);
  }

  flatMap<U>(map: (x: T) => Iterable<U>) {
    const it = this;
    const gen = function* () {
      for (const item of it) yield* map(item);
    };
    return new Iterator(gen);
  }

  enumerate() {
    const it = this;
    const gen = function* () {
      let count = 0;
      for (const item of it) {
        yield [item, count++] as [item: T, i: number];
      }
    };
    return new Iterator(gen);
  }

  take(count: number) {
    const it = this;
    const gen = function* () {
      let _count = 0;
      for (const item of it) {
        if (_count++ > count) return;
        yield item;
      }
    };
    return new Iterator(gen);
  }

  chain<U>(rest: Iterable<U>) {
    const it = this;
    const gen = function* () {
      yield* it;
      yield* rest;
    };
    return new Iterator(gen);
  }

  cycle() {
    const it = this;
    const gen = function* () {
      const buffer: T[] = [];

      for (const x of it) {
        buffer.push(x);
        yield x;
      }

      while (true) {
        yield* buffer;
      }
    };
    return new Iterator(gen);
  }

  static repeat<T>(x: T) {
    const gen = function* () {
      while (true) yield x;
    };
    return new Iterator(gen);
  }

  static range(start: number, end: number) {
    const gen = function* () {
      while (start < end) yield start++;
    };
    return new Iterator(gen);
  }

  static natural(end: number) {
    return this.range(0, end);
  }

  static iter<T>(x: Iterable<T>) {
    const gen = function* () {
      yield* x;
    };
    return new Iterator(gen);
  }

  static iterEntries<K extends string | number | symbol, T>(x: Record<K, T>) {
    const gen = function* () {
      for (const key in x) yield [key, x[key]] as [key: K, value: T];
    };
    return new Iterator(gen);
  }

  static iterKeys<K extends string | number | symbol>(x: Record<K, unknown>) {
    const gen = function* () {
      for (const key in x) yield key;
    };
    return new Iterator(gen);
  }

  toArray() {
    return [...this];
  }

  // it doesn't work(
  // method should be available only if generic type is a tuple of form [key: string | number | symbol, value: unknown]
  // aka specialization
  toObject(this: Iterator<RecordEntry>) {
    type Inferred = T extends RecordEntry ? Record<T[0], T[1]> : never;
    return Object.fromEntries(this.toArray()) as Inferred;
  }
}
