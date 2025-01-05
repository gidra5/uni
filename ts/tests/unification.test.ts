import { Constraint, TypeBounds, UnificationTable } from "../src/analysis/types/unification";
import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { Type } from "../src/analysis/types/infer";

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
  test("normalize 2", () =>
    testCase({ 0: [{ subtype: "int" }] }, { 0: { supertype: "void", subtype: { and: ["unknown", "int"] } } }));
  test("normalize 3", () =>
    testCase({ 0: [{ supertype: "int" }] }, { 0: { supertype: { or: ["void", "int"] }, subtype: "unknown" } }));
  test("normalize 3", () =>
    testCase({ 0: [{ exactly: "int" }] }, { 0: { exactly: "int", supertype: "void", subtype: "unknown" } }));
  test("normalize 7", () =>
    testCase(
      { 0: [{ subtype: { not: "int" } }] },
      { 0: { supertype: "void", subtype: { and: ["unknown", { not: "int" }] } } }
    ));
  test("normalize 3", () =>
    testCase(
      { 0: [{ exactly: "int" }, { subtype: "int" }] },
      { 0: { exactly: "int", supertype: "void", subtype: { and: ["unknown", "int"] } } }
    ));
  test("normalize 3", () =>
    testCase(
      { 0: [{ exactly: "int" }, { supertype: "string" }] },
      { 0: { exactly: "int", supertype: { or: ["void", "string"] }, subtype: "unknown" } }
    ));
  test("normalize 3", () =>
    testCase(
      { 0: [{ exactly: "int" }, { supertype: "string" }, { subtype: "int" }] },
      { 0: { exactly: "int", supertype: { or: ["void", "string"] }, subtype: { and: ["unknown", "int"] } } }
    ));
  test("normalize 4", () =>
    testCase(
      { 0: [{ subtype: "int" }, { subtype: "int" }] },
      { 0: { supertype: "void", subtype: { and: ["unknown", "int", "int"] } } }
    ));
  test("normalize 5", () =>
    testCase(
      { 0: [{ subtype: "int" }, { subtype: "string" }] },
      { 0: { supertype: "void", subtype: { and: ["unknown", "int", "string"] } } }
    ));

  test("normalize", () =>
    testCase(
      { 0: [{ subtype: "int" }], 1: [{ equals: 0 }] },
      { 0: { supertype: "void", subtype: "int" }, 1: { supertype: "void", subtype: "int" } }
    ));
  test("normalize 6", () =>
    testCase(
      { 0: [{ subtype: "int" }, { subtype: { or: ["int", "string"] } }] },
      { 0: { supertype: "void", subtype: "int" } }
    ));
  test("normalize 7", () =>
    testCase(
      { 0: [{ subtype: { not: "int" } }, { subtype: { or: ["int", "string"] } }] },
      { 0: { supertype: "void", subtype: "string" } }
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

test.only.prop([constraintArb, constraintArb])("constraints commute", (constraint1, constraint2) => {
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
