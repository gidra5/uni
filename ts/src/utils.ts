export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg ? `Assertion failed: ${msg}` : "Assertion failed");
  }
}

export const omit = <T extends {}, K extends string>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key as K))
  ) as Omit<T, K>;
};

export const pick = <T extends {}, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => keys.includes(key as K))
  ) as Pick<T, K>;
};

export class Iterator<T> {
  constructor(private generator: Generator<T>) {}

  [Symbol.iterator]() {
    return this.generator;
  }

  reduce<U>(reducer: (acc: U, input: T) => U, initial: U) {
    const it = this;
    let acc = initial;
    for (const item1 of it.generator) {
      acc = reducer(acc, item1);
    }
    return acc;
  }

  groupBy<U>(group: (input: Generator<T>) => Generator<U>) {
    const it = this;
    return new Iterator(group(it.generator));
  }

  product<U>(gen2: Iterable<U>) {
    const it = this;
    const gen = function* () {
      for (const item1 of it.generator) {
        for (const item2 of gen2) yield [item1, item2] as [first: T, second: U];
      }
    };
    return new Iterator(gen());
  }

  filter(pred: (x: T) => boolean): Iterator<T>;
  filter<U extends T>(pred: (x: T) => x is U) {
    const it = this;
    const gen = function* () {
      for (const item of it.generator) if (pred(item)) yield item;
    };
    return new Iterator(gen());
  }

  map<U>(map: (x: T) => U) {
    const it = this;
    const gen = function* () {
      for (const item of it.generator) yield map(item);
    };
    return new Iterator(gen());
  }

  filterMap<U>(map: (x: T) => { pred: false } | { pred: true; value: U }) {
    const it = this;
    const gen = function* () {
      for (const item of it.generator) {
        const result = map(item);
        if (result.pred) yield result.value;
      }
    };
    return new Iterator(gen());
  }

  flatMap<U>(map: (x: T) => Iterable<U>) {
    const it = this;
    const gen = function* () {
      for (const item of it.generator) yield* map(item);
    };
    return new Iterator(gen());
  }

  enumerate() {
    const it = this;
    const gen = function* () {
      let count = 0;
      for (const item of it.generator) {
        yield [item, count++] as [item: T, i: number];
      }
    };
    return new Iterator(gen());
  }

  take(count: number) {
    const it = this;
    const gen = function* () {
      let _count = 0;
      for (const item of it.generator) {
        if (_count++ > count) return;
        yield item;
      }
    };
    return new Iterator(gen());
  }

  chain<U>(rest: Iterator<U>) {
    const it = this;
    const gen = function* () {
      yield* it.generator;
      yield* rest.generator;
    };
    return new Iterator(gen());
  }

  cycle() {
    const it = this;
    const gen = function* () {
      const buffer: T[] = [];

      for (const x of it.generator) {
        buffer.push(x);
        yield x;
      }

      while (true) {
        for (const x of buffer) yield x;
      }
    };
    return new Iterator(gen());
  }

  static repeat<T>(x: T) {
    const gen = function* () {
      while (true) yield x;
    };
    return new Iterator(gen());
  }

  static range(start: number, end: number) {
    const gen = function* () {
      while (start < end) yield start++;
    };
    return new Iterator(gen());
  }

  static natural(end: number) {
    return this.range(0, end);
  }

  static iter<T>(x: Iterable<T>) {
    const gen = function* () {
      for (const item of x) yield item;
    };
    return new Iterator(gen());
  }

  static iterEntries<K extends string | number | symbol, T>(x: Record<K, T>) {
    const gen = function* () {
      for (const key in x) yield [key, x[key]] as [key: K, value: T];
    };
    return new Iterator(gen());
  }

  static iterKeys<K extends string | number | symbol>(x: Record<K, unknown>) {
    const gen = function* () {
      for (const key in x) yield key;
    };
    return new Iterator(gen());
  }

  toArray() {
    return [...this.generator];
  }

  toObject(
    this: T extends [string | number | symbol, unknown] ? Iterator<T> : never
  ) {
    return Object.fromEntries(this.toArray()) as T extends [
      string | number | symbol,
      unknown
    ]
      ? Record<T[0], T[1]>
      : never;
  }
}
