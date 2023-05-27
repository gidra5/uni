export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

export class Iterator<T> {
  constructor(private generator: Generator<T>) {}

  [Symbol.iterator]() {
    return this.generator;
  }

  groupBy<U>(group: (input: Generator<T>) => Generator<U>) {
    const it = this;
    return new Iterator(group(it.generator));
  }

  product<U>(gen2: Iterable<U>) {
    const it = this;
    const gen = function* () {
      for (const item1 of it.generator) {
        for (const item2 of gen2) {
          yield [item1, item2] as [first: T, second: U];
        }
      }
    };
    return new Iterator(gen());
  }

  map<U>(map: (x: T) => U) {
    const it = this;
    const gen = function* () {
      for (const item of it.generator) {
        yield map(item);
      }
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
        for (const x of buffer) {
          yield x;
        }
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
      while (start < end) {
        yield start++;
      }
    };
    return new Iterator(gen());
  }

  static natural(end: number) {
    return this.range(0, end);
  }

  static iter<T>(x: Iterable<T>) {
    const gen = function* () {
      for (const item of x) {
        yield item;
      }
    };
    return new Iterator(gen());
  }

  static iterEntries<K extends string | number | symbol, T>(x: Record<K, T>) {
    const gen = function* () {
      for (const key in x) {
        yield [key, x[key]] as [key: K, value: T];
      }
    };
    return new Iterator(gen());
  }

  toArray() {
    return [...this.generator];
  }

  toObject(
    this: T extends [string | number | symbol, unknown] ? Iterator<T> : never
  ) {
    return Object.fromEntries(this.toArray());
  }
}
