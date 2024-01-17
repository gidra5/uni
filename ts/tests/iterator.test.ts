import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import Iterator from "../src/iterator.js";
import { array } from "fast-check";

describe("iterator", () => {
  it.prop([fc.array(fc.anything())])("Iterator.iter", (array) => {
    const iterator = Iterator.iter(array);
    expect(iterator.toArray()).toEqual(array);
  });

  it.prop([fc.array(fc.nat())])("Iterator is Iterable", (array) => {
    const iterator = Iterator.iter(array);
    let sum = 0;
    for (const value of iterator) {
      sum += value;
    }

    expect(sum).toEqual(10);
  });

  it.prop([fc.array(fc.anything())])("Iterator.count", (array) => {
    expect(Iterator.iter(array).count()).toEqual(array.length);
  });

  it.prop([fc.array(fc.anything())])("Iterator.count on consumed iterator", (array) => {
    expect(Iterator.iter(array).skip(array.length).count()).toEqual(0);
  });

  it.prop([fc.array(fc.nat())])("Iterator.reduce", (array) => {
    const reducer = (acc: number, current: number) => acc + current;
    expect(Iterator.iter(array).reduce(reducer, 0)).toEqual(array.reduce(reducer, 0));
  });

  it.prop([fc.array(fc.nat())])("Iterator.reduce with no initialValue", (array) => {
    const reducer = (acc: number, current: number) => acc + current;
    expect(Iterator.iter(array).reduce(reducer)).toEqual(array.reduce(reducer));
  });

  it.prop([fc.array(fc.nat())])("Iterator.map", (array) => {
    const mapper = (value: number) => value * 2;
    expect(Iterator.iter(array).map(mapper).toArray()).toEqual(array.map(mapper));
  });

  it.prop([fc.array(fc.nat())])("Iterator.filter", (array) => {
    const predicate = (value: number) => value % 2 === 0;
    expect(Iterator.iter(array).filter(predicate).toArray()).toEqual(array.filter(predicate));
  });

  it.prop([fc.array(fc.nat())])("Iterator.filterMap", (array) => {
    const filterMapped = Iterator.iter(array)
      .filterMap((value) => (value > 2 ? value * 2 : undefined))
      .toArray();
    expect(filterMapped).toEqual(array.filter((value) => value > 2).map((value) => value * 2));
  });

  it.prop([fc.array(fc.array(fc.array(fc.array(fc.anything())))), fc.nat()])("Iterator.flat", (array, depth) => {
    const flatArray = array.flat(depth);
    expect(Iterator.iter(array).flat(depth).toArray()).toEqual(flatArray);
  });

  it.prop([fc.array(fc.array(fc.array(fc.array(fc.anything()))))])("Iterator.flat with no depth", (array) => {
    const flatArray = array.flat();
    expect(Iterator.iter(array).flat().toArray()).toEqual(flatArray);
  });

  it.prop([fc.array(fc.nat())])("Iterator.flatMap", (array) => {
    const mapper = (value: number) => [value, value];
    expect(Iterator.iter(array).flatMap(mapper).toArray()).toEqual(array.flatMap(mapper));
  });

  it.prop([fc.array(fc.anything()), fc.array(fc.anything())])("Iterator.zip", (array1, array2) => {
    const zipped = Iterator.iter(array1).zip(array2).toArray();
    const length = Math.min(array1.length, array2.length);
    expect(zipped.length).toEqual(length);
    for (const i of Iterator.natural(length)) {
      expect(zipped[i]).toEqual([array1[i], array2[i]]);
    }
  });

  it.prop([fc.array(fc.array(fc.anything()), { minLength: 3 })])("Iterator.zip with multiple iterators", (arrays) => {
    const [head, ...rest] = arrays;
    const zipped = Iterator.iter(head)
      .zip(...rest)
      .toArray();
    const length = Math.min(...arrays.map((arr) => arr.length));
    expect(zipped.length).toEqual(length);
    for (const i of Iterator.natural(length)) {
      expect(zipped[i]).toEqual(arrays.map((arr) => arr[i]));
    }
  });

  it.prop([fc.array(fc.array(fc.anything()), { minLength: 2 })])("Iterator.chain", (arrays) => {
    const chained = Iterator.chain(arrays).toArray();
    expect(chained).toEqual(arrays.flat());
  });

  it.prop([fc.array(fc.anything())])("Iterator.enumerate", (array) => {
    const enumerated = Iterator.iter(array).enumerate().toArray();
    expect(enumerated).toEqual(array.map((value, index) => [index, value]));
  });

  it.prop([fc.array(fc.anything()), fc.nat()])("Iterator.take", (array, size) => {
    const taken = Iterator.iter(array).take(size).toArray();
    expect(taken).toEqual(array.slice(0, size));
  });

  it.prop([fc.array(fc.nat())])("Iterator.takeWhile", (array) => {
    const predicate = (value: number) => value < 3;
    const taken = Iterator.iter(array).takeWhile(predicate).toArray();
    const expected = array.slice(
      0,
      array.findIndex((value) => !predicate(value))
    );
    expect(taken).toEqual(expected);
  });

  it.prop([fc.array(fc.anything()), fc.nat()])("Iterator.skip", (array, size) => {
    const skipped = Iterator.iter(array).skip(size).toArray();
    expect(skipped).toEqual(array.slice(size));
  });

  it.prop([fc.array(fc.nat())])("Iterator.skipWhile", (array) => {
    const predicate = (value: number) => value < 3;
    const skipped = Iterator.iter(array).skipWhile(predicate).toArray();
    const expected = array.slice(array.findIndex((value) => !predicate(value)));
    expect(skipped).toEqual(expected);
  });

  test("Iterator.partition empty", () => {
    const p = Iterator.iter([]).partition();
    expect(p, [[], []]);
  });

  test("Iterator.partition boolean fn", () => {
    const p = Iterator.iter([1, 2, 3, 4, 5]).partition((v) => v % 2 === 0);
    expect(p, [
      [1, 3, 5],
      [2, 4],
    ]);
  });

  test("Iterator.partition number fn", () => {
    const p = Iterator.iter([1, 2, 3, 4, 5]).partition((v) => v % 2);
    expect(p, [
      [2, 4],
      [1, 3, 5],
    ]);
  });

  test("Iterator.partition number fn multiple", () => {
    const p = Iterator.iter([1, 2, 3, 4, 5]).partition((v) => v % 3);
    expect(p, [[3], [1, 4], [2, 5]]);
  });

  test("Iterator.every that must return true", () => {
    test.assert(Iterator.iter(array).every((element) => element > 0));
  });

  test("Iterator.every that must return false", () => {
    test.assertNot(Iterator.iter(array).every((element) => element % 2));
  });

  test("Iterator.some that must return true", () => {
    test.assert(Iterator.iter(array).some((element) => element % 2));
  });

  test("Iterator.some that must return false", () => {
    test.assertNot(Iterator.iter(array).some((element) => element < 0));
  });

  test("Iterator.find that must find an element", () => {
    expect(
      Iterator.iter(array).find((element) => element % 2 === 0),
      2
    );
  });

  test("Iterator.find that must not find an element", () => {
    expect(
      Iterator.iter(array).find((element) => element > 4),
      undefined
    );
  });

  test("Iterator.join default", () => {
    const actual = Iterator.iter(array).join();
    expect(actual).toEqual("1,2,3,4");
  });

  test("Iterator.join", () => {
    const actual = Iterator.iter(array).join(", ");
    expect(actual).toEqual("1, 2, 3, 4");
  });

  test("RangeIterator with start and stop", () => {
    const actual = Iterator.range(1, 5).toArray();
    expect(actual).toEqual([1, 2, 3, 4]);
  });

  test("RangeIterator with start, stop and step", () => {
    const actual = Iterator.range(1, 6, 2).toArray();
    expect(actual).toEqual([1, 3, 5]);
  });

  test("RangeIterator without start", () => {
    const actual = Iterator.range(5).toArray();
    expect(actual).toEqual([0, 1, 2, 3, 4]);
  });

  test("RangeIterator reverse", () => {
    const actual = Iterator.range(4, -1, -1).toArray();
    expect(actual).toEqual([4, 3, 2, 1, 0]);
  });

  test("RangeIterator empty range", () => {
    const actual = Iterator.range(0).toArray();
    expect(actual).toEqual([]);
  });

  test("RangeIterator empty range with start > stop", () => {
    const actual = Iterator.range(1, 0).toArray();
    expect(actual).toEqual([]);
  });

  test("Iterator.toObject simple", () => {
    const actual = Iterator.iter([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]).toObject();
    expect(actual).toEqual({ a: 1, b: 2, c: 3 });
  });

  test("Iterator.toObject empty", () => {
    const actual = Iterator.iter([]).toObject();
    expect(actual).toEqual({});
  });

  test("Iterator.toObject with map", () => {
    const actual = Iterator.range(0, 3)
      .map((i) => [String.fromCharCode(97 + i), i])
      .toObject();
    expect(actual).toEqual({ a: 0, b: 1, c: 2 });
  });

  test("Iterator.toObject with '0', '1' properties", () => {
    // According to spec https://tc39.github.io/ecma262/#sec-add-entries-from-iterable
    const actual = Iterator.range(0, 3)
      .map((i) => ({ 0: String.fromCharCode(97 + i), 1: i }))
      .toObject();
    expect(actual).toEqual({ a: 0, b: 1, c: 2 });
  });

  test("Iterator.max no values", () => {
    const actual = Iterator.iter([]).max();
    expect(actual).toEqual(undefined);
  });

  test("Iterator.max simple", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).max();
    expect(actual).toEqual(5);
  });

  test("Iterator.max accessor", () => {
    const arr = [{ val: 5 }, { val: 4 }, { val: 3 }, { val: 9 }, { val: 4 }];
    const actual = Iterator.iter(arr).max((v) => v.val);
    expect(actual).toEqual(arr[3]);
  });

  test("Iterator.min no values", () => {
    const actual = Iterator.iter([]).min();
    expect(actual).toEqual(undefined);
  });

  test("Iterator.min simple", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).min();
    expect(actual).toEqual(1);
  });

  test("Iterator.min accessor", () => {
    const arr = [{ val: 5 }, { val: 4 }, { val: 3 }, { val: 9 }, { val: 4 }];
    const actual = Iterator.iter(arr).min((v) => v.val);
    expect(actual).toEqual(arr[2]);
  });

  test("Iterator.findCompare no values", () => {
    const actual = Iterator.iter([]).findCompare();
    expect(actual).toEqual(undefined);
  });

  test("Iterator.findCompare simple", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).findCompare((curr, next) => curr === undefined || next < 3);
    expect(actual).toEqual(2);
  });

  test("Iterator.findCompare accessor", () => {
    const arr = [{ val: 5 }, { val: 4 }, { val: 3 }, { val: 9 }, { val: 4 }];
    const actual = Iterator.iter(arr).findCompare(
      (curr, next) => curr === undefined || Math.abs(curr - next) < 2,
      (v) => v.val
    );
    expect(actual).toEqual(arr[4]);
  });

  test("Iterator.groupBy empty", () => {
    const actual = Iterator.iter([]).groupBy((v) => v % 2);
    expect(actual).toEqual(new Map());
  });

  test("Iterator.groupBy numbers", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) => v % 2);
    expect(actual).toEqual(
      new Map([
        [1, [1, 3, 5]],
        [0, [2, 4]],
      ])
    );
  });

  test("Iterator.groupBy strings", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) => (v % 2).toString());
    expect(actual).toEqual(
      new Map([
        ["1", [1, 3, 5]],
        ["0", [2, 4]],
      ])
    );
  });

  test("Iterator.groupBy objects", () => {
    const even = { type: "even" };
    const odd = { type: "odd" };
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) => (v % 2 === 0 ? even : odd));
    expect(actual).toEqual(
      new Map([
        [odd, [1, 3, 5]],
        [even, [2, 4]],
      ])
    );
  });

  test("iterEntries must iterate over object entries", () => {
    const source = { a: 13, b: 42, c: "hello" };
    expect(Iterator.iterEntries(source).toArray()).toEqual(Object.entries(source));
  });

  test("iterKeys must iterate over object keys", () => {
    const source = { a: 13, b: 42, c: "hello" };
    expect(Iterator.iterKeys(source).toArray()).toEqual(Object.keys(source));
  });

  test("iterValues must iterate over object values", () => {
    const source = { a: 13, b: 42, c: "hello" };
    expect(Iterator.iterValues(source).toArray()).toEqual(Object.values(source));
  });
});
