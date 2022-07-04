export function* range(
  start: number,
  end: number
): Generator<number, number, unknown> {
  while (start < end) {
    yield start++;
  }
  return start;
}

export const rangeFromZero = (
  end: number
): Generator<number, number, unknown> => range(0, end);

export function* iter<T>(x: Array<T>): Generator<T, void, unknown> {
  for (const item of x) {
    yield item;
  }
}

export function* map<T, U>(
  gen: IterableIterator<T>,
  map: (x: T) => U
): Generator<U, void, unknown> {
  for (const item of gen) {
    yield map(item);
  }
}

export function* enumerate<T>(
  gen: IterableIterator<T>
): Generator<[item: T, i: number], void, unknown> {
  let count = 0;
  for (const item of gen) {
    yield [item, count++] as [item: T, i: number];
  }
}

export function* repeat<T>(x: T, count: number): Generator<T, void, unknown> {
  for (let i = 0; i < count; ++i) yield x;
}

export function* product<T, U>(
  gen1: IterableIterator<T>,
  gen2: IterableIterator<U>
): Generator<[first: T, second: U], void, unknown> {
  const buffer = [...gen2];
  for (const item1 of gen1) {
    for (const item2 of buffer) {
      yield [item1, item2];
    }
  }
}

export function* groupBy<
  T extends unknown,
  U extends unknown,
  P extends (input: T[], index: number) => [U, number]
>(str: T[], parse: P) {
  let index = 0;

  while (str[index] !== "") {
    const [token, nextIndex] = parse(str, index);
    index = nextIndex;
    yield token;
  }
}
