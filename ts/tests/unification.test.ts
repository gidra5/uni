import { UnificationTable } from "../src/analysis/types/unification";
import { expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { typeArb, typeWithVariablesArb } from "../src/analysis/types/utils";

const constraintArb = fc.oneof(
  // fc.record({ subtype: typeArb }),
  // fc.record({ supertype: typeArb }),
  fc.record({ exactly: typeArb })
);

const constraintWithVariablesArb = (variables: number[]) =>
  fc.oneof(
    // fc.record({ subtype: typeWithVariablesArb(variables) }),
    // fc.record({ supertype: typeWithVariablesArb(variables) }),
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

test.prop([unificationTableArb])("unification table truncation invariant", (table) => {
  table.truncate();

  for (const constraints of table.constraints.values()) {
    if (Array.isArray(constraints)) continue;
    const otherVariable = constraints.equals;
    const otherConstraints = table.constraints.get(otherVariable);
    if (!otherConstraints) continue;
    if (Array.isArray(otherConstraints)) continue;
    if (otherConstraints.equals === otherVariable) continue;
    expect.unreachable("invariant unsatisfied");
  }
});

test.prop([unificationTableArb])("unification table tautology truncation invariant", (table) => {
  table.truncate();
  table.truncateTautologies();

  for (const constraints of table.constraints.values()) {
    if (Array.isArray(constraints)) continue;
    const otherVariable = constraints.equals;
    const otherConstraints = table.constraints.get(otherVariable);
    if (!otherConstraints) continue;
    if (Array.isArray(otherConstraints)) continue;
    expect.unreachable("invariant unsatisfied");
  }
});

test.prop([unificationTableArb])("unification table resolution never throws", (table) => {
  expect(() => table.resolve(0)).not.toThrow();
});

test.prop([constraintSetArb])("unification table resolution order irrelevant", (sets) => {
  const table = new UnificationTable();
  for (const { variable, constraints } of sets) {
    for (const constraint of constraints) {
      table.addConstraint(variable, constraint);
    }
  }
  const first1 = table.resolve(0);
  const second1 = table.resolve(1);
  table.resolved.clear();
  const first2 = table.resolve(1);
  const second2 = table.resolve(0);

  expect(first1).toEqual(second2);
  expect(second1).toEqual(first2);
});
