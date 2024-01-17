import { RecordEntry, RecordKey, Zip, ZipLongest } from "./types";
import { identity, isEqual } from "./utils";

export default class Iterator<T> implements Iterable<T> {
  private constructor(private generator: () => Generator<T>) {}

  [Symbol.iterator]() {
    return this.generator();
  }

  // base methods

  cached() {
    let it = this.generator();
    let buffer: T[] = [];
    let consumed = false;
    const gen = function* () {
      let index = 0;
      while (true) {
        if (index < buffer.length) {
          yield buffer[index];
          index++;
          continue;
        }
        if (consumed) break;
        const item = it.next();
        if (!item.done) {
          buffer.push(item.value);
          yield item.value;
          index++;
        } else {
          consumed = item.done;
          break;
        }
      }
    };
    return new Iterator(gen);
  }

  consumable() {
    const it = this.generator();
    return new Iterator(() => it);
  }

  reduce(reducer: (acc: T, input: T) => T): T;
  reduce<U>(reducer: (acc: U, input: T) => U, initial: U): U;
  reduce(reducer: (acc: any, input: T) => any, initial?: any) {
    const it = this.consumable();
    let acc = initial ?? it.head()!;
    for (const item1 of it) {
      acc = reducer(acc, item1);
    }
    return acc;
  }

  accumulate<U>(reducer: (acc: U, input: T) => U, initial: U) {
    const it = this;
    const gen = function* () {
      let acc = initial;
      yield acc;
      for (const item of it) {
        acc = reducer(acc, item);
        yield acc;
      }
    };
    return new Iterator(gen);
  }

  product(): Iterator<[T]>;
  product<U>(gen2: Iterable<U>): Iterator<[T, U]>;
  product<U, V>(gen2: Iterable<U>, gen3: Iterable<V>): Iterator<[T, U, V]>;
  product(...args: Iterable<T>[]): Iterator<T[]>;
  product(...args: Iterable<T>[]) {
    const head = this;
    if (args.length === 0) return head.map((x) => [x]);
    const iterators = args.map((it) => Iterator.iter(it).cached());
    const gen = function* () {
      const [it, ...rest] = iterators;
      for (const item of head) {
        yield* it.product(...rest).map((tuple) => [item, ...tuple]);
      }
    };
    return new Iterator(gen);
  }

  filter(pred: (x: T) => boolean): Iterator<T>;
  filter<U extends T>(pred: (x: T) => x is U): Iterator<U>;
  filter(pred: (x: T) => boolean) {
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

  flat<U, V extends Iterable<U>>(this: Iterator<V>): Iterator<U>;
  flat<U>(this: Iterator<Iterable<U> | U>, depth: 1): Iterator<U>;
  flat<U>(this: Iterator<Iterable<Iterable<U> | U> | Iterable<U> | U>, depth: 2): Iterator<U>;
  flat<U, V extends Iterable<U>>(this: Iterator<U | V>, depth: number): Iterator<U>;
  flat<U, V extends Iterable<U>>(this: Iterator<V>, depth = 1) {
    const it = this;
    const gen = function* () {
      for (const item of it) {
        if (!item[Symbol.iterator]) yield item;
        else if (depth === 1) yield * item;
        else yield * Iterator.iter(item).flat(depth - 1);
      }
    };
    return new Iterator(gen);
  }

  takeWhile(pred: (x: T) => boolean) {
    const it = this;
    const gen = function* () {
      for (const item of it) {
        if (!pred(item)) return;
        yield item;
      }
    };
    return new Iterator(gen);
  }

  skipWhile(pred: (x: T) => boolean) {
    const it = this;
    const gen = function* () {
      let started = false;
      for (const item of it) {
        if (!started && !pred(item)) started = true;
        if (started) yield item;
      }
    };
    return new Iterator(gen);
  }

  chain(...rest: Iterable<T>[]) {
    return Iterator.chain(this, ...rest);
  }

  append(...next: T[]) {
    const it = this;
    const gen = function* () {
      yield* it;
      yield * next;
    };
    return new Iterator(gen);
  }

  prepend(...prev: T[]) {
    const it = this;
    const gen = function* () {
      yield * prev;
      yield* it;
    };
    return new Iterator(gen);
  }

  cycle() {
    const it = this.cached();
    const gen = function* () {
      while (true) {
        yield* it;
      }
    };
    return new Iterator(gen);
  }

  chunks(size: number) {
    const it = this.consumable();
    const gen = function* () {
      while (true) {
        const chunk = it.take(size).toArray();
        if (chunk.length === 0) return;
        yield chunk;
      }
    };
    return new Iterator(gen);
  }

  sample() {
    const it = this.cycle().consumable();
    const gen = function* () {
      while (true) yield it.skip(Math.floor(Math.random())).head();
    };
    return new Iterator(gen);
  }

  // static methods

  static zip<T extends Iterable<unknown>[]>(...iterables: T): Iterator<Zip<T>>;
  static zip<T extends Iterable<unknown>[]>(...iterables: T) {
    const iterators = iterables.map((it) => it[Symbol.iterator]());
    const gen = function* () {
      while (true) {
        const items = iterators.map((it) => it.next());
        if (items.some((x) => x.done)) return;
        yield items.map((x) => x.value) as Zip<T>;
      }
    };
    return new Iterator(gen);
  }

  static zipLongest<T extends Iterable<unknown>[]>(...iterables: T): Iterator<ZipLongest<T>>;
  static zipLongest<T extends Iterable<unknown>[]>(...iterables: T) {
    const iterators = iterables.map((it) => it[Symbol.iterator]());
    const gen = function* () {
      while (true) {
        const items = iterators.map((it) => it.next());
        if (items.every((x) => x.done)) return;
        yield items.map((x) => x.value) as ZipLongest<T>;
      }
    };
    return new Iterator(gen);
  }

  static chain<T>(...iterables: Iterable<T>[]) {
    return Iterator.iter(iterables).flatMap(identity);
  }

  static random() {
    const gen = function* () {
      while (true) yield Math.random();
    };
    return new Iterator(gen);
  }

  static randomItems<T>(items: T[]) {
    return Iterator.random().map((x) => items[Math.floor(x * items.length)]);
  }

  // just copypaste of https://more-itertools.readthedocs.io/en/stable/_modules/more_itertools/more.html#partitions
  static partitions<T>(items: T[]) {
    return Iterator.subsets(Iterator.range(1, items.length)).map((x) => {
      return Iterator.iter([0, ...x])
        .zip([...x, items.length])
        .map(([a, b]) => items.slice(a, b))
        .toArray();
    });
  }

  static combinations<T>(items: T[], size = items.length) {
    const range = Iterator.natural(items.length).toArray();

    return Iterator.permutation(range, size).filterMap((indices) => {
      const pred = isEqual(indices, indices.slice().sort());
      return pred ? { pred, value: indices.map((i) => items[i]) } : { pred };
    });
  }

  static combinationsWithReplacement<T>(items: T[], size = items.length) {
    return Iterator.natural(items.length)
      .power(size)
      .filterMap((indices) => {
        if (isEqual(indices, indices.slice().sort())) return indices.map((i) => items[i]);
      });
  }

  static permutation<T>(items: T[], size = items.length): Iterator<T[]> {
    const gen = function* () {
      if (size > items.length) return;
      if (size === 0) yield [];
      for (const x of items) {
        const rest = items.filter((_x) => _x !== x);
        const restPermutations = Iterator.permutation(rest, size - 1);
        yield* restPermutations.map((xs) => [x, ...xs]);
      }
    };
    return new Iterator<T[]>(gen);
  }

  static subsets<T>(items: Iterable<T>): Iterator<T[]> {
    const it = Iterator.iter(items).cached();
    const gen = function* () {
      yield it.toArray();
      for (const x of it) {
        const remainingItems = it.filter((_x) => _x !== x);
        yield* Iterator.subsets(remainingItems);
      }
    };
    return new Iterator(gen);
  }

  static subslices<T>(items: T[]) {
    const it = Iterator.iter(items);
    return Iterator.natural(items.length)
      .map((size) => [it.take(size), size] as [Iterator<T>, number])
      .flatMap(([it, size]) => Iterator.natural(size).map((offset) => it.skip(offset).toArray()));
  }

  static roundRobin<T>(...iterables: Iterable<T>[]) {
    const iterators = iterables.map((it) => it[Symbol.iterator]());
    const gen = function* () {
      while (true) {
        for (const it of [...iterators]) {
          const item = it.next();
          if (item.done) {
            iterators.splice(iterators.indexOf(it), 1);
            if (iterators.length === 0) return;
            continue;
          }
          yield item.value;
        }
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

  static range(start: number, end: number, step = 1) {
    const gen = function* () {
      while (start !== end) {
        yield start;
        start += step;
      }
    };
    return new Iterator(gen);
  }

  static natural(end: number = Infinity) {
    return this.range(0, end);
  }

  static iter<T>(x: Iterable<T>) {
    const gen = function* () {
      yield* x;
    };
    return new Iterator(gen);
  }

  static iterEntries<K extends RecordKey, T>(x: Record<K, T>) {
    const gen = function* () {
      for (const key in x) yield [key, x[key]] as [key: K, value: T];
    };
    return new Iterator(gen);
  }

  static iterKeys<K extends RecordKey>(x: Record<K, unknown>) {
    const gen = function* () {
      for (const key in x) yield key;
    };
    return new Iterator(gen);
  }

  static iterValues<T>(x: Record<RecordKey, T>) {
    const gen = function* () {
      for (const key in x) yield x[key];
    };
    return new Iterator(gen);
  }

  // collection methods

  toArray() {
    return [...this];
  }

  toObject(this: Iterator<RecordEntry>) {
    type Inferred = T extends RecordEntry ? Record<T[0], T[1]> : never;
    return Object.fromEntries(this.toArray()) as Inferred;
  }

  toMap<K, V>(this: Iterator<[K, V]>) {
    return new Map(this);
  }

  toSet(this: Iterator<T>) {
    return new Set(this);
  }

  // derived methods

  join(this: Iterator<string>, separator = "") {
    return this.reduce((acc, x) => acc + separator + x);
  }

  max(this: Iterator<number>): number;
  max(accessor: (x: T) => number): number;
  max(accessor: (x: T) => number = identity as any) {
    return this.map(accessor).reduce(Math.max);
  }

  min(this: Iterator<number>): number;
  min(accessor: (x: T) => number): number;
  min(accessor: (x: T) => number = identity as any) {
    return this.map(accessor).reduce(Math.min);
  }

  sum(this: Iterator<number>): number;
  sum(accessor: (x: T) => number): number;
  sum(accessor: (x: T) => number = identity as any) {
    return this.map(accessor).reduce((acc, x) => acc + x, 0);
  }

  mul(this: Iterator<number>): number;
  mul(accessor: (x: T) => number): number;
  mul(accessor: (x: T) => number = identity as any) {
    return this.map(accessor).reduce((acc, x) => acc * x, 1);
  }

  some(this: Iterator<boolean>): boolean;
  some(pred: (x: T) => boolean): boolean;
  some(pred: (x: T) => boolean = identity as any) {
    return !this.filter(pred).isEmpty();
  }

  every(this: Iterator<boolean>): boolean;
  every(pred: (x: T) => boolean): boolean;
  every(pred: (x: T) => boolean = identity as any) {
    return !this.some((x) => !pred(x));
  }

  isEmpty() {
    return this.take(1).count() === 0;
  }

  count() {
    return this.reduce((acc) => acc + 1, 0);
  }

  power(n: 1): Iterator<T>;
  power(n: number): Iterator<T[]>;
  power(n: number): Iterator<T[] | T> {
    if (n === 1) return this;
    return this.product(...Iterator.repeat(this).take(n - 1)).map((t) => t.flat(Infinity) as T[]);
  }

  zip<U extends Iterable<unknown>[]>(...iterables: U) {
    return Iterator.zip<[typeof this, ...U]>(this, ...iterables);
  }

  zipLongest<U extends Iterable<unknown>[]>(...iterables: U) {
    return Iterator.zipLongest<[typeof this, ...U]>(this, ...iterables);
  }

  spreadMap<U extends unknown[], V>(this: Iterator<U>, map: (...args: U) => V) {
    return this.map((args) => map(...args));
  }

  spreadFilterMap<U extends unknown[], V>(this: Iterator<U>, map: (...args: U) => V | undefined) {
    return this.filterMap((args) => map(...args));
  }

  spreadFlatMap<U extends unknown[], V>(this: Iterator<U>, map: (...args: U) => Iterable<V>) {
    return this.flatMap((args) => map(...args));
  }

  spreadPartition<U extends unknown[]>(this: Iterator<U>, pred: (...args: U) => boolean): [Iterator<U>, Iterator<U>] {
    return this.partition((args) => pred(...args));
  }

  spreadInspect<U extends unknown[]>(this: Iterator<U>, callback: (...args: U) => void) {
    return this.inspect((args) => callback(...args));
  }

  spreadSkipWhile<U extends unknown[]>(this: Iterator<U>, pred: (...args: U) => boolean) {
    return this.skipWhile((args) => pred(...args));
  }

  spreadTakeWhile<U extends unknown[]>(this: Iterator<U>, pred: (...args: U) => boolean) {
    return this.takeWhile((args) => pred(...args));
  }

  spreadReduce<U extends unknown[], V>(this: Iterator<U>, reducer: (acc: V, ...args: U) => V, initial: V) {
    return this.reduce((acc, args) => reducer(acc, ...args), initial);
  }

  spreadAccumulate<U extends unknown[], V>(this: Iterator<U>, reducer: (acc: V, ...args: U) => V, initial: V) {
    return this.accumulate((acc, args) => reducer(acc, ...args), initial);
  }

  filterMap<U>(map: (x: T) => U | undefined | void) {
    return this.map(map).filter<U>((x): x is U => x !== undefined);
  }

  flatMap<U>(map: (x: T) => Iterable<U>) {
    return this.map(map).flat();
  }

  unzip<U>(this: Iterator<[U]>): [Iterator<U>];
  unzip<U, V>(this: Iterator<[U, V]>): [Iterator<U>, Iterator<V>];
  unzip<U, V, W>(this: Iterator<[U, V, W]>): [Iterator<U>, Iterator<V>, Iterator<W>];
  unzip<U>(this: Iterator<U[]>, size?: number): Iterator<U>[];
  unzip<U>(this: Iterator<U[]>, size = Infinity): Iterator<U>[] {
    size = Math.min(size, this.head()?.length ?? 0);
    return Iterator.natural(size)
      .map((i) => this.map((x) => x[i]))
      .toArray();
  }

  enumerate() {
    return this.zip(Iterator.natural());
  }

  take(count: number) {
    let _count = 0;
    return this.takeWhile(() => _count++ < count);
  }

  skip(count: number) {
    let _count = 0;
    return this.skipWhile(() => _count++ < count);
  }

  partition<U extends T>(pred: (x: T) => x is U): [Iterator<U>, Iterator<T>];
  partition(pred: (x: T) => boolean): [Iterator<T>, Iterator<T>];
  partition(pred: (x: T) => boolean): [Iterator<T>, Iterator<T>] {
    return [this.filter(pred), this.filter((x) => !pred(x))];
  }

  window(size: 1): Iterator<[T]>;
  window(size: 2): Iterator<[T, T]>;
  window(size: 3): Iterator<[T, T, T]>;
  window(size: 4): Iterator<[T, T, T, T]>;
  window(size: 5): Iterator<[T, T, T, T, T]>;
  window(size: 6): Iterator<[T, T, T, T, T, T]>;
  window(size: number): Iterator<T[]>;
  window(size: number): Iterator<T[]> {
    const it = this.cached();
    const iterators = Iterator.range(1, size).map((i) => it.skip(i));
    return it.zip(...iterators);
  }

  dot(this: Iterator<number>, gen2: Iterable<number>) {
    return this.zip(gen2)
      .map((x) => x[0] * x[1])
      .sum();
  }

  convolve(this: Iterator<number>, kernel: number[]) {
    return this.window(kernel.length).dot(kernel);
  }

  padBefore(size: number, value: T) {
    return Iterator.repeat(value).take(size).chain(this);
  }

  padAfter(size: number, value: T) {
    return this.chain(Iterator.repeat(value).take(size));
  }

  pad(size: number, value: T) {
    return this.padBefore(size, value).padAfter(size, value);
  }

  nth(n: number) {
    return this.skip(n).take(1).toArray()[0] as T | undefined;
  }

  head() {
    return this.nth(0);
  }

  allUnique() {
    const seen = new Set();
    return this.map((x) => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    }).every();
  }

  isInOrder(compare: (a: T, b: T) => boolean) {
    return this.window(2).spreadMap(compare).every();
  }

  inspect(callback: (x: T) => void) {
    return this.map((x) => (callback(x), x));
  }

  equals<U>(gen2: Iterable<U>, compare: (a: T, b: U) => boolean) {
    return this.zip(gen2).spreadMap(compare).every();
  }

  groupBy<U>(key: (x: T) => U) {
    return this.reduce((map, x) => {
      const k = key(x);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(x);
      return map;
    }, new Map<U, T[]>());
  }

  find(pred: (x: T) => boolean) {
    return this.filter(pred).head();
  }
}
