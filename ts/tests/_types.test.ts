import { describe, expect } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { compareTypes, dataTypeArb, isTypeEqual, Type, typeArb } from "../src/analysis/types/utils";
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
    expect.soft(ab).toBeGreaterThanOrEqual(-1);
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

// define void and unknown for every primitive type

describe("subtyping", () => {
  test.prop([typeArb], {
    skipEqualValues: true,
    // examples: [
    //   [{ and: [{ and: [] }, "void"] }],
    //   [{ not: { not: "void" } }],
    //   [{ or: [{ not: { or: [] } }] }],
    //   [{ or: [{ or: [{ not: { or: [] } }] }, { not: { not: "void" } }] }],
    //   [{ and: [] }],
    //   [{ or: [] }],
    //   [{ and: [{ or: [] }, { and: [] }] }],
    //   [{ not: { and: [] } }],
    //   [{ or: [{ not: { and: [] } }] }],
    //   [{ or: [{ not: { and: ["boolean", { not: "boolean" }] } }, { and: ["boolean", { not: "boolean" }] }] }],
    //   [{ and: ["boolean", { not: "boolean" }] }],
    //   [{ or: [{ and: ["int", "boolean"] }, "string"] }],
    //   [{ and: [{ not: "boolean" }, "void"] }],
    //   [{ and: ["string", "boolean"] }],
    // ],
  })("subtyping is reflexive", (type) => {
    expect(isSubtype(type, copy(type))).toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb], { skipEqualValues: true })("subtyping is transitive", (a, b, c) => {
    const ab = isSubtype(a, b);
    const bc = isSubtype(b, c);
    const ac = isSubtype(a, c);
    if (ab && bc) expect(ac).toBe(true);
  });

  test.prop(
    [
      fc
        .array(typeArb)
        .map((ts) => Iterator.iter(ts).unique(isTypeEqual).toArray())
        .chain<[Type[], Type]>((types) =>
          typeArb.filter((t) => types.every((type) => isSubtype(type, t))).map((t) => [types, t])
        ),
    ],
    { skipEqualValues: true }
  )("union is a lattice join", ([types, upperBound]) => {
    const join: Type = { or: types };

    expect
      .soft(
        types.every((t) => isSubtype(t, join)),
        "join is an upper bound"
      )
      .toBe(true);

    expect(isSubtype(join, upperBound), "join is the least upper bound").toBe(true);
  });

  test.prop(
    [
      fc
        .array(typeArb)
        .map((ts) => Iterator.iter(ts).unique(isTypeEqual).toArray())
        .chain<[Type[], Type]>((types) =>
          typeArb.filter((t) => types.every((type) => isSubtype(t, type))).map((t) => [types, t])
        ),
    ],
    { skipEqualValues: true }
  )("intersection is a lattice meet", ([types, lowerBound]) => {
    const meet: Type = { and: types };

    expect
      .soft(
        types.every((t) => isSubtype(meet, t)),
        "meet is a lower bound"
      )
      .toBe(true);

    expect(isSubtype(lowerBound, meet), "meet is the greatest lower bound").toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb], {
    skipEqualValues: true,
    examples: [["float", "string", "void"]],
  })("meet distributes over join", (a, b, c) => {
    const lhs = { and: [a, { or: [b, c] }] };
    const rhs = { or: [{ and: [a, b] }, { and: [a, c] }] };

    expect(isSubtypeEqual(lhs, rhs)).toBe(true);
  });

  test.prop([typeArb, typeArb], { skipEqualValues: true, examples: [[{ record: [] }, "string"]] })(
    "meet is commutative",
    (a, b) => {
      expect(isSubtypeEqual({ and: [a, b] }, { and: [b, a] })).toBe(true);
    }
  );

  test.prop([typeArb, typeArb], { skipEqualValues: true })("join is commutative", (a, b) => {
    expect(isSubtypeEqual({ or: [a, b] }, { or: [b, a] })).toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb], {
    skipEqualValues: true,
    examples: [["string", "string", { record: [] }]],
  })("meet is associative", (a, b, c) => {
    expect(isSubtypeEqual({ and: [a, { and: [b, c] }] }, { and: [{ and: [a, b] }, c] })).toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb], { skipEqualValues: true })("join is associative", (a, b, c) => {
    expect(isSubtypeEqual({ or: [{ or: [a, b] }, c] }, { or: [a, { or: [b, c] }] })).toBe(true);
  });

  test.prop([typeArb], { skipEqualValues: true })("double negation", (a) => {
    expect(isSubtypeEqual({ not: { not: a } }, a)).toBe(true);
  });

  test.prop([typeArb, typeArb], { skipEqualValues: true, examples: [["void", { record: [] }]] })(
    "de-morgan's law",
    (a, b) => {
      const lhs = { not: { or: [a, b] } };
      const rhs = { and: [{ not: a }, { not: b }] };

      expect(isSubtypeEqual(lhs, rhs), "de-morgan law").toBe(true);
    }
  );

  test.prop([fc.array(typeArb, { minLength: 1 })], { skipEqualValues: true })(
    "intersection is subtype of union",
    (a) => {
      expect(isSubtype({ and: a }, { or: a })).toBe(true);
    }
  );

  test.prop([typeArb], { skipEqualValues: true })("anything is subtype of unknown", (a) => {
    expect(isSubtype(a, "unknown")).toBe(true);
  });

  test.prop([typeArb], { skipEqualValues: true })("void is subtype of anything", (a) => {
    expect(isSubtype("void", a)).toBe(true);
  });

  test.prop([typeArb], { skipEqualValues: true, examples: [[{ record: [] }]] })("excluded middle and", (a) => {
    expect(isSubtypeEqual({ and: [a, { not: a }] }, "void")).toBe(true);
  });

  test.prop([typeArb], {
    skipEqualValues: true,
    examples: [["float"]],
  })("excluded middle or", (a) => {
    expect(isSubtypeEqual({ or: [a, { not: a }] }, "unknown")).toBe(true);
  });

  test.prop([typeArb.chain((t) => typeArb.filter((t2) => isSubtype(t, t2)).map<[Type, Type]>((t2) => [t, t2]))], {
    skipEqualValues: true,
  })("meet chooses min type", ([a, b]) => {
    expect(isSubtypeEqual({ and: [a, b] }, a)).toBe(true);
  });

  test.prop([typeArb.chain((t) => typeArb.filter((t2) => isSubtype(t, t2)).map<[Type, Type]>((t2) => [t, t2]))], {
    skipEqualValues: true,
  })("join chooses max type", ([a, b]) => {
    expect(isSubtypeEqual({ or: [a, b] }, b)).toBe(true);
  });

  test("void and unknown are opposites", () => {
    expect.soft(isSubtypeEqual("void", { not: "unknown" })).toBe(true);
    expect.soft(isSubtypeEqual("unknown", { not: "void" })).toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb, typeArb], { skipEqualValues: true })("disjoint intersections", (a, b, c, d) => {
    const lhs = { and: [{ fn: { arg: a, return: b } }, { fn: { arg: c, return: d } }] };
    const rhs = {
      and: [
        { fn: { arg: { and: [a, { not: c }] }, return: b } },
        { fn: { arg: { and: [a, c] }, return: { or: [b, d] } } },
        { fn: { arg: { and: [{ not: a }, c] }, return: d } },
      ],
    };

    expect(isSubtypeEqual(lhs, rhs)).toBe(true);
  });

  test.prop([typeArb, typeArb, typeArb, typeArb], { skipEqualValues: true })("union of functions", (a, b, c, d) => {
    const lhs = { or: [{ fn: { arg: a, return: b } }, { fn: { arg: c, return: d } }] };
    const rhs = { fn: { arg: { and: [a, c] }, return: { or: [b, d] } } };

    expect(isSubtypeEqual(lhs, rhs)).toBe(true);
  });

  test.prop([typeArb.chain((t) => typeArb.filter((t2) => isSubtype(t, t2)).map<[Type, Type]>((t2) => [t, t2]))], {
    skipEqualValues: true,
  })("negation swaps order", ([a, b]) => {
    expect(isSubtype({ not: b }, { not: a })).toBe(true);
  });

  describe("datatype subtyping", () => {
    test.prop(
      [
        fc.array(typeArb).chain<[Type[], Type[]]>((types) =>
          fc
            .array(typeArb, { maxLength: types.length })
            .filter((_types) => _types.every((type, i) => isSubtype(types[i], type)))
            .map((_types) => [types, _types])
        ),
      ],
      { skipEqualValues: true }
    )("tuple subtyping", ([types, supertypes]) => {
      expect(isSubtype({ record: types }, { record: supertypes })).toBe(true);
    });

    test.prop([fc.array(typeArb)], { skipEqualValues: true })("empty tuple is tuple top type", (types) => {
      expect(isSubtype({ record: types }, { record: [] })).toBe(true);
    });

    // test.prop([fc.array(typeArb)], { skipEqualValues: true })("??? is tuple bottom type", (types) => {
    //   expect(isSubtype({ record: types }, { record: [] })).toBe(true); // ?
    // });

    test.prop([typeArb, typeArb, fc.option(fc.array(typeArb), { nil: undefined })], { skipEqualValues: true })(
      "void -> unknown is a function top type",
      (arg, _return, closure) => {
        const fnType = { fn: { arg, return: _return, closure } };
        const fnTopType: Type = { fn: { arg: "void", return: "unknown" } };
        expect(isSubtype(fnType, fnTopType)).toBe(true);
      }
    );

    test.prop([typeArb, typeArb, fc.option(fc.array(typeArb), { nil: undefined })], { skipEqualValues: true })(
      "unknown -> void is a function bottom type",
      (arg, _return, closure) => {
        const fnType = { fn: { arg, return: _return, closure } };
        const fnBottomType: Type = { fn: { arg: "unknown", return: "void" } };
        expect(isSubtype(fnBottomType, fnType)).toBe(true);
      }
    );
  });
});
