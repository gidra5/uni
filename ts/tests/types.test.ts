import { describe, expect } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { compareTypes, isTypeEqual, typeArb } from "../src/analysis/types/utils";

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
