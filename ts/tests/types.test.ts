import { describe, expect } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { compareTypes, isTypeEqual, Type, typeArb } from "../src/analysis/types/utils";
import { isSubtype, isSubtypeEqual } from "../src/analysis/types/infer";
import { Iterator } from "iterator-js";
import { copy } from "../src/utils/copy";

// since type equality is based on type compare, its sufficient to only test symmetricity
describe("type equality", () => {
  test.prop([typeArb, typeArb])("type equality is symmetric", (a, b) => {
    expect(isTypeEqual(a, b)).toBe(isTypeEqual(b, a));
  });
});

describe("type compare", () => {
  test.prop([typeArb, typeArb])("type compare result is between -1 and 1", (a, b) => {
    const ab = compareTypes(a, b);
    expect(ab).toBeGreaterThanOrEqual(-1);
    expect(ab).toBeLessThanOrEqual(1);
  });

  test.prop([typeArb])("type compare is reflexive", (type) => {
    expect(compareTypes(type, type)).toBe(0);
  });

  test.prop([typeArb, typeArb])("type compare is anti symmetric", (a, b) => {
    const ab = compareTypes(a, b);
    const ba = compareTypes(b, a);
    // because +0 !== -0 for .toBe
    if (ab === 0) expect(ba).toBe(0);
    else expect(ab).toBe(-ba);
  });

  test.prop([typeArb, typeArb, typeArb])("type compare is transitive", (a, b, c) => {
    const ab = compareTypes(a, b);
    const bc = compareTypes(b, c);
    const ac = compareTypes(a, c);
    if (ab > 0 && bc > 0) expect(ac > 0).toBe(true);
    else if (ab < 0 && bc < 0) expect(ac < 0).toBe(true);
    else if (ab === 0 && bc === 0) expect(ac === 0).toBe(true);
  });
});

describe("subtyping", () => {
  test.only.prop([typeArb], {
    skipEqualValues: true,
    examples: [
      [{ or: [{ and: ["int", "boolean"] }, "string"] }],
      // [{ and: [{ not: "boolean" }, "void"] }],
      // [{ and: ["string", "boolean"] }],
      // [{ not: { or: [{ not: "boolean" }, "boolean"] } }],
      // [{ or: [{ not: "boolean" }, "boolean"] }],
    ],
  })("subtyping is reflexive", (type) => {
    expect(isSubtype(type, copy(type))).toBe(true);
  });

  test.prop([typeArb, typeArb])("subtyping is anti symmetric", (a, b) => {
    const ab = isSubtype(a, b);
    const ba = isSubtype(b, a);
    expect(ab).toBe(!ba);
  });

  test.prop([typeArb, typeArb, typeArb])("subtyping is transitive", (a, b, c) => {
    const ab = isSubtype(a, b);
    const bc = isSubtype(b, c);
    const ac = isSubtype(a, c);
    if (ab && bc) expect(ac).toBe(true);
    else if (!ab && !bc) expect(!ac).toBe(true);
  });

  test.prop([
    fc
      .array(typeArb)
      .map((ts) => Iterator.iter(ts).unique(isTypeEqual).toArray())
      .chain<[Type[], Type]>((types) =>
        typeArb.filter((t) => types.every((type) => isSubtype(t, type))).map((t) => [types, t])
      ),
  ])("union is a lattice join", ([types, upperBound]) => {
    const join: Type = { or: types };

    expect(
      types.every((t) => isSubtype(t, join)),
      "join is an upper bound"
    ).toBe(true);

    expect(isSubtype(join, upperBound), "join is the least upper bound").toBe(true);
  });

  test.prop([
    fc
      .array(typeArb)
      .map((ts) => Iterator.iter(ts).unique(isTypeEqual).toArray())
      .chain<[Type[], Type]>((types) =>
        typeArb.filter((t) => types.every((type) => isSubtype(type, t))).map((t) => [types, t])
      ),
  ])("intersection is a lattice meet", ([types, lowerBound]) => {
    const meet: Type = { and: types };

    expect(
      types.every((t) => isSubtype(meet, t)),
      "meet is a lower bound"
    ).toBe(true);

    expect(isSubtype(lowerBound, meet), "meet is the greatest lower bound").toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb])("meet distributes over join", (a, b, c) => {
    const lhs = { and: [a, { or: [b, c] }] };
    const rhs = { or: [{ and: [a, b] }, { and: [a, c] }] };

    expect(isSubtypeEqual(lhs, rhs)).toBe(true);
  });
});
