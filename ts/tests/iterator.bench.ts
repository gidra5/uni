import { describe, bench, afterEach } from "vitest";
import Iterator from "../src/iterator";
import MetarhiaIterator from "@metarhia/iterator";

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
const sizes = Iterator.range(1, 6)
  .map((i) => 0.2 * i * 10 ** i)
  .map(Math.round);

for (const size of sizes) {
  const iteratorNat = Iterator.natural(size);
  const array = iteratorNat.toArray();
  const iterator = Iterator.iter(array);

  for (const [name, _iterator] of Iterator.iterEntries({
    iterator,
    iteratorNat,
  })) {
    describe.concurrent(`${name} iteration cache - ${size}`, () => {
      bench(name, () => {
        testIteration(_iterator);
      });

      bench(`${name}.cached`, () => {
        testIteration(_iterator.cached());
      });

      bench(`${name}.consumable`, () => {
        testIteration(_iterator.consumable());
      });
    });
  }

  describe.concurrent(`iteration - ${size}`, () => {
    const iteratorNat = Iterator.natural(size);
    const array = iteratorNat.toArray();
    const iterator = Iterator.iter(array);
    const metarhiaIterator = () => MetarhiaIterator.iter(array);
    const reducer = (acc: number, x: number) => acc + x;

    for (const [name, _iterator] of Iterator.iterEntries({
      iterator,
      iteratorNat,
    })) {
      bench(name, () => {
        testIteration(_iterator);
      });

      bench(`${name}.reduce`, () => {
        _iterator.reduce(reducer, 0);
      });

      bench(`${name}.sum`, () => {
        _iterator.sum();
      });
    }

    bench(`Array`, () => {
      testIteration(array);
    });

    bench(`Array.reduce`, () => {
      array.reduce(reducer, 0);
    });

    bench(`MetarhiaIterator`, () => {
      testIteration(metarhiaIterator());
    });

    bench(`MetarhiaIterator.reduce`, () => {
      metarhiaIterator().reduce(reducer, 0);
    });
  });

  // describe.concurrent(`iteration complex - ${size}`, () => {
  //   const array = createArray(size);
  //   const iterator = Iterator.iter(array);
  //   const iteratorNat = Iterator.natural(size);

  // });
}
