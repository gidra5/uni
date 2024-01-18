import { describe, bench, afterEach } from "vitest";
import Iterator from "../src/iterator";

afterEach(async () => {
  // flush promises https://github.com/vitest-dev/vitest/issues/4497#
  await new Promise((res) => setImmediate(res));
});

const testIteration = (iterator: Iterable<number>) => {
  let sum = 0;
  for (const value of iterator) {
    sum += value;
  }
};
const sizes = Iterator.natural(6)
  .map((i) => 0.2 * i * 10 ** i)
  .map(Math.round);

for (const size of sizes) {
  describe.concurrent(`iteration - ${size}`, () => {
    const iteratorNat = Iterator.natural(size);
    const array = iteratorNat.toArray();
    const iterator = Iterator.iter(array);

    Iterator.iterEntries({ iterator, iteratorNat }).consume(
      ([name, iterator]) => {
        bench(name, () => {
          testIteration(iterator);
        });

        bench(`${name}.cached`, () => {
          testIteration(iterator.cached());
        });

        bench(`${name}.consumable`, () => {
          testIteration(iterator.consumable());
        });

        bench(`${name}.sum`, () => {
          iterator.sum();
        });

        bench(`${name}.cached.sum`, () => {
          iterator.cached().sum();
        });

        bench(`${name}.consumable.sum`, () => {
          iterator.consumable().sum();
        });
      }
    );

    bench(`Array`, () => {
      testIteration(array);
    });

    bench(`Array.reduce`, () => {
      array.reduce((a, b) => a + b, 0);
    });
  });

  // describe.concurrent(`iteration complex - ${size}`, () => {
  //   const array = createArray(size);
  //   const iterator = Iterator.iter(array);
  //   const iteratorNat = Iterator.natural(size);

  // });
}
