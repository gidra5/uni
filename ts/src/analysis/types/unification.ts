import { assert, unreachable } from "../../utils";
import { Type } from "./infer";

export type Constraint = { subtype: Type } | { supertype: Type } | { exactly: Type } | { equals: number };
export type TypeBounds = { supertype: Type; subtype: Type; exactly?: Type } | { equals: number };

const canonicalLiteralTypesOrder = ["int", "float", "string", "unknown", "void"];
const canonicalComplexTypesOrder = ["fn", "and", "or", "not"];
const canonicalConstraintOrder = ["equals", "exactly", "subtype", "supertype"];

const compareTypes = (a: Type, b: Type): number => {
  if (typeof a === "string") {
    if (typeof b === "string") {
      return canonicalLiteralTypesOrder.indexOf(a) - canonicalLiteralTypesOrder.indexOf(b);
    }
    return -1;
  }
  if (typeof b === "string") {
    return 1;
  }
  assert(typeof a === "object" && typeof b === "object");
  const aKind = Object.keys(a)[0];
  const bKind = Object.keys(b)[0];
  if (aKind !== bKind) {
    return canonicalComplexTypesOrder.indexOf(aKind) - canonicalComplexTypesOrder.indexOf(bKind);
  }

  switch (aKind) {
    case "fn": {
      assert("fn" in a);
      assert("fn" in b);
      const argsCompare = compareTypes(a.fn.arg, b.fn.arg);
      if (argsCompare !== 0) return argsCompare;
      return compareTypes(a.fn.return, b.fn.return);
    }
    case "and": {
      assert("and" in a);
      assert("and" in b);
      const andCompare = a.and.length - b.and.length;
      if (andCompare !== 0) return andCompare;
      for (let i = 0; i < a.and.length; i++) {
        const andCompare = compareTypes(a.and[i], b.and[i]);
        if (andCompare !== 0) return andCompare;
      }
      return 0;
    }
    case "or": {
      assert("or" in a);
      assert("or" in b);
      const orCompare = a.or.length - b.or.length;
      if (orCompare !== 0) return orCompare;
      for (let i = 0; i < a.or.length; i++) {
        const orCompare = compareTypes(a.or[i], b.or[i]);
        if (orCompare !== 0) return orCompare;
      }
      return 0;
    }
    case "not": {
      assert("not" in a);
      assert("not" in b);
      return compareTypes(a.not, b.not);
    }
  }

  return 0;
};

const compareConstraints = (a: Constraint, b: Constraint): number => {
  const aKind = Object.keys(a)[0];
  const bKind = Object.keys(b)[0];
  if (aKind !== bKind) {
    return canonicalConstraintOrder.indexOf(aKind) - canonicalConstraintOrder.indexOf(bKind);
  }
  const aType = a[aKind];
  const bType = b[bKind];
  return compareTypes(aType, bType);
};

export class UnificationTable {
  constraints: Map<number, Constraint[]> = new Map();
  resolved: Map<number, TypeBounds> = new Map();

  normalize(type: TypeBounds): TypeBounds {
    if ("equals" in type) {
      return this.resolve(type.equals);
    }
    return type;
  }

  unifySubtypes(a: Type, b: Type): Type {
    if (a === "void") return b;
    if (b === "void") return a;
    if (a === b) return a;
    return "unknown";
  }

  unify(a: TypeBounds, b: Constraint): TypeBounds {
    assert(!("equals" in a));
    assert(!("equals" in b));
    if ("exactly" in b) {
      const type = b.exactly;
      const boundsType = a.exactly;
      if (!boundsType) return { ...a, exactly: type };
      return { ...a, exactly: { and: [boundsType, type] } };
    }
    return { ...a, ...b };

    unreachable("cant unify");
  }

  resolve(variable: number): TypeBounds {
    let bounds: TypeBounds = { subtype: "unknown", supertype: "void" };
    const constraints = this.constraints.get(variable);
    if (!constraints) {
      this.resolved.set(variable, bounds);
      return bounds;
    }

    if (constraints.some((c) => "equals" in c)) {
      assert(constraints.length === 1);
      const otherConstraint = constraints[0];
      assert("equals" in otherConstraint);
      const otherVariable = otherConstraint.equals;
      return this.resolve(otherVariable);
    }

    for (const constraint of constraints) {
      bounds = this.unify(bounds, constraint);
    }

    this.resolved.set(variable, bounds);
    return bounds;
  }

  addConstraint(variable: number, constraint: Constraint) {
    const constraints = this.constraints.get(variable);
    if (!constraints) {
      this.constraints.set(variable, [constraint]);
      return;
    }

    if ("equals" in constraint) {
      const otherVariable = constraint.equals;

      for (const otherConstraint of constraints) {
        this.addConstraint(otherVariable, otherConstraint);
      }

      this.constraints.set(variable, [constraint]);
      return;
    }

    if (constraints.some((c) => "equals" in c)) {
      assert(constraints.length === 1);
      const otherConstraint = constraints[0];
      assert("equals" in otherConstraint);
      const otherVariable = otherConstraint.equals;
      this.addConstraint(otherVariable, constraint);
      return;
    }

    constraints.push(constraint);
    constraints.sort(compareConstraints);
  }
}
