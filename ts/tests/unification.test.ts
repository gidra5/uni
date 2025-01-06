import { Constraint, TypeBounds, UnificationTable } from "../src/analysis/types/unification";
import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { Type } from "../src/analysis/types/infer";
import { Iterator } from "iterator-js";

const testCase = (constraints: Record<number, Constraint[]>, expected: Record<number, TypeBounds>) => {
  const table = new UnificationTable();
  for (const variable in constraints) {
    for (const constraint of constraints[variable]) {
      table.addConstraint(Number(variable), constraint);
    }
  }

  for (const variable in expected) {
    expect(table.resolve(Number(variable))).toEqual(expected[variable]);
  }
};

describe("unification", () => {
  test("normalize 2", () => testCase({ 0: [{ subtype: "int" }] }, { 0: { subtype: "int" } }));
  test("normalize 3", () => testCase({ 0: [{ supertype: "int" }] }, { 0: { supertype: "int" } }));
  test("normalize 3", () => testCase({ 0: [{ exactly: "int" }] }, { 0: { exactly: "int" } }));
  test("normalize 3", () =>
    testCase({ 0: [{ exactly: "int" }, { subtype: "int" }] }, { 0: { exactly: "int", subtype: "int" } }));
  test("normalize 3", () =>
    testCase({ 0: [{ exactly: "int" }, { supertype: "string" }] }, { 0: { exactly: "int", supertype: "string" } }));
  test("normalize 3", () =>
    testCase(
      { 0: [{ exactly: "int" }, { supertype: "string" }, { subtype: "int" }] },
      { 0: { exactly: "int", supertype: "string", subtype: "int" } }
    ));
  test("normalize 4", () =>
    testCase({ 0: [{ subtype: "int" }, { subtype: "string" }] }, { 0: { subtype: { and: ["int", "string"] } } }));
  test("normalize 5", () =>
    testCase({ 0: [{ supertype: "int" }, { supertype: "string" }] }, { 0: { supertype: { or: ["int", "string"] } } }));
  test("normalize", () =>
    testCase({ 0: [{ subtype: "int" }], 1: [{ equals: 0 }] }, { 0: { subtype: "int" }, 1: { subtype: "int" } }));
  test("normalize 9", () =>
    testCase(
      { 0: [{ exactly: "int" }], 1: [{ exactly: { or: ["int", { variable: 0 }] } }] },
      { 0: { exactly: "int" }, 1: { exactly: { or: ["int", "int"] } } }
    ));
  test("normalize 8", () =>
    testCase(
      { 0: [{ subtype: "int" }], 1: [{ exactly: { fn: { arg: { variable: 0 }, return: "int", closure: [] } } }] },
      { 0: { subtype: "int" }, 1: { exactly: { fn: { arg: "int", return: "int", closure: [] } } } }
    ));
  test("normalize 8", () =>
    testCase(
      { 0: [{ supertype: "int" }], 1: [{ exactly: { fn: { arg: "int", return: { variable: 0 }, closure: [] } } }] },
      { 0: { supertype: "int" }, 1: { exactly: { fn: { arg: "int", return: "int", closure: [] } } } }
    ));
  test("normalize 8", () =>
    testCase(
      { 0: [{ subtype: "int" }], 1: [{ exactly: { fn: { arg: "int", return: "int", closure: [{ variable: 0 }] } } }] },
      { 0: { subtype: "int" }, 1: { exactly: { fn: { arg: "int", return: "int", closure: ["int"] } } } }
    ));

  test("normalize 8", () => testCase({ 0: [{ equals: 0 }] }, { 0: {} }));
  test("normalize 8", () => testCase({ 0: [{ exactly: { variable: 0 } }] }, { 0: {} }));
  test("normalize 8", () => testCase({ 0: [{ equals: 1 }], 1: [{ equals: 0 }] }, { 0: {}, 1: {} }));
  test("normalize 8", () =>
    testCase(
      { 0: [{ exactly: { fn: { arg: { variable: 1 }, return: { variable: 2 }, closure: [{ variable: 3 }] } } }] },
      { 0: { exactly: { fn: { arg: { variable: 1 }, return: { variable: 2 }, closure: [{ variable: 3 }] } } } }
    ));
});

const typeArb = fc.letrec<{ type: Type }>((typeArb) => ({
  type: fc.oneof(
    fc.constant<"int">("int"),
    fc.constant<"float">("float"),
    fc.constant<"string">("string"),
    fc.constant<"unknown">("unknown"),
    fc.constant<"void">("void"),
    fc.record({ fn: fc.record({ arg: typeArb("type"), return: typeArb("type"), closure: fc.array(typeArb("type")) }) }),
    fc.record({ and: fc.array(typeArb("type"), { minLength: 2 }) }).map((type) => ({
      and: type.and.flatMap((type) => (typeof type === "object" && "and" in type ? type.and : [type])),
    })),
    fc.record({ or: fc.array(typeArb("type"), { minLength: 2 }) }).map((type) => ({
      or: type.or.flatMap((type) => (typeof type === "object" && "or" in type ? type.or : [type])),
    })),
    fc
      .record({ not: typeArb("type") })
      .map((type) => (typeof type.not === "object" && "not" in type.not ? type.not.not : type))
  ),
})).type;

const constraintArb = fc.oneof(
  fc.record({ subtype: typeArb }),
  fc.record({ supertype: typeArb }),
  fc.record({ exactly: typeArb })
);

const typeWithVariablesArb = (variables: number[]) =>
  fc.letrec<{ type: Type }>((typeArb) => ({
    type: fc.oneof(
      fc.constant<"int">("int"),
      fc.constant<"float">("float"),
      fc.constant<"string">("string"),
      fc.constant<"unknown">("unknown"),
      fc.constant<"void">("void"),
      fc.record({
        fn: fc.record({ arg: typeArb("type"), return: typeArb("type"), closure: fc.array(typeArb("type")) }),
      }),
      fc.record({ and: fc.array(typeArb("type"), { minLength: 2 }) }).map((type) => ({
        and: type.and.flatMap((type) => (typeof type === "object" && "and" in type ? type.and : [type])),
      })),
      fc.record({ or: fc.array(typeArb("type"), { minLength: 2 }) }).map((type) => ({
        or: type.or.flatMap((type) => (typeof type === "object" && "or" in type ? type.or : [type])),
      })),
      fc
        .record({ not: typeArb("type") })
        .map((type) => (typeof type.not === "object" && "not" in type.not ? type.not.not : type)),
      fc.record({ variable: fc.integer() }),
      fc.oneof(...variables.map((variable) => fc.record({ variable: fc.constant(variable) })))
    ),
  })).type;

const constraintWithVariablesArb = (variables: number[]) =>
  fc.oneof(
    fc.record({ subtype: typeWithVariablesArb(variables) }),
    fc.record({ supertype: typeWithVariablesArb(variables) }),
    fc.record({ exactly: typeWithVariablesArb(variables) }),
    fc.record({ equals: fc.integer() }),
    fc.oneof(...variables.map((variable) => fc.record({ equals: fc.constant(variable) })))
  );

const constraintSetArb = fc
  .array(fc.integer(), { minLength: 1 })
  .chain((variables) =>
    fc.tuple(
      ...variables.map((variable) =>
        fc
          .array(constraintWithVariablesArb(variables), { minLength: 1, size: "small" })
          .map((constraints) => ({ variable, constraints }))
      )
    )
  );

const unificationTableArb = constraintSetArb.map((sets) => {
  const table = new UnificationTable();
  for (const { variable, constraints } of sets) {
    for (const constraint of constraints) {
      table.addConstraint(variable, constraint);
    }
  }
  return table;
});

test.prop([constraintArb, constraintArb])("constraints commute", (constraint1, constraint2) => {
  const table1 = new UnificationTable();
  table1.addConstraint(0, constraint1);
  table1.addConstraint(0, constraint2);

  const table2 = new UnificationTable();
  table2.addConstraint(0, constraint2);
  table2.addConstraint(0, constraint1);

  const resolved1 = table1.resolve(0);
  const resolved2 = table2.resolve(0);
  expect(resolved1).toEqual(resolved2);
});

test.prop([fc.array(constraintArb, { minLength: 1 }), fc.array(constraintArb, { minLength: 1 })])(
  "if variables are independent, they can be unified separately",
  (constraints1, constraints2) => {
    const table1 = new UnificationTable();
    const table2 = new UnificationTable();
    const table3 = new UnificationTable();

    for (const constraint of constraints1) {
      table1.addConstraint(0, constraint);
      table2.addConstraint(0, constraint);
    }

    for (const constraint of constraints2) {
      table1.addConstraint(1, constraint);
      table3.addConstraint(0, constraint);
    }

    const resolved1 = table1.resolve(0);
    const resolved2 = table1.resolve(1);
    const resolved3 = table2.resolve(0);
    const resolved4 = table3.resolve(0);

    expect(resolved1).toEqual(resolved3);
    expect(resolved2).toEqual(resolved4);
  }
);

// test.prop([unificationTableArb])("unification table resolution never throws", (table) => {
//   expect(() => table.resolve(0)).not.toThrow();
// });

// test.prop([constraintSetArb])("unification table resolution order", (sets) => {
//   const table = new UnificationTable();
//   for (const { variable, constraints } of sets) {
//     for (const constraint of constraints) {
//       table.addConstraint(variable, constraint);
//     }
//   }
//   const first1 = table.resolve(0);
//   const second1 = table.resolve(1);
//   table.resolved.clear();
//   const first2 = table.resolve(1);
//   const second2 = table.resolve(0);

//   expect(first1).toEqual(second2);
//   expect(second1).toEqual(first2);
// });
