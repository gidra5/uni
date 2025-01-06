import { assert, unreachable } from "../../utils";
import { Type } from "./infer";

export type Constraint = { subtype: Type } | { supertype: Type } | { exactly: Type } | { equals: number };
export type TypeBounds = { supertype?: Type; subtype?: Type; exactly?: Type } | { equals: number };

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
  resolved: Map<number, TypeBounds | null> = new Map();

  boundsToSubtype(variable: number, bounds: TypeBounds): Type {
    if ("equals" in bounds) {
      return this.resolveSubtype(bounds.equals);
    }
    // const type = bounds.exactly ?? { variable: 0 };
    // if (bounds.subtype) {
    //   return { and: [type, bounds.subtype] };
    // }
    // return type;

    if (bounds.subtype) {
      return bounds.subtype;
    }
    return bounds.exactly ?? { variable };
  }

  boundsToSupertype(variable: number, bounds: TypeBounds): Type {
    if ("equals" in bounds) {
      return this.resolveSupertype(bounds.equals);
    }
    // const type = bounds.exactly ?? { variable: 0 };
    // if (bounds.supertype) {
    //   return { or: [type, bounds.supertype] };
    // }
    // return type;

    if (bounds.supertype) {
      return bounds.supertype;
    }
    return bounds.exactly ?? { variable };
  }

  boundsToExactType(variable: number, bounds: TypeBounds): Type {
    if ("equals" in bounds) {
      return this.resolveExactType(bounds.equals);
    }
    const type = bounds.exactly ?? { variable };
    if (bounds.subtype && bounds.supertype) {
      return { and: [{ or: [bounds.supertype, type] }, bounds.subtype] };
    }
    if (bounds.subtype) {
      return { and: [type, bounds.subtype] };
    }
    if (bounds.supertype) {
      return { or: [bounds.supertype, type] };
    }
    return type;
  }

  normalizeSubtype(type: Type): Type | null {
    if (typeof type === "object" && "and" in type) {
      const normalized = type.and.map((type) => this.normalizeSubtype(type));
      if (normalized.some((type) => !type)) return null;
      return { and: normalized as Type[] };
    }
    if (typeof type === "object" && "or" in type) {
      const normalized = type.or.map((type) => this.normalizeSubtype(type));
      if (normalized.some((type) => !type)) return null;
      return { or: normalized as Type[] };
    }
    if (typeof type === "object" && "not" in type) {
      const normalized = this.normalizeSubtype(type.not);
      if (!normalized) return null;
      return { not: normalized };
    }
    if (typeof type === "object" && "fn" in type) {
      const normalizedArg = this.normalizeSubtype(type.fn.arg);
      if (!normalizedArg) return null;
      const normalizedReturn = this.normalizeSupertype(type.fn.return);
      if (!normalizedReturn) return null;
      const normalizedClosure = type.fn.closure.map((t) => this.normalizeSubtype(t));
      if (normalizedClosure.some((type) => !type)) return null;
      return { fn: { arg: normalizedArg, return: normalizedReturn, closure: normalizedClosure as Type[] } };
    }
    if (typeof type === "object" && "variable" in type) {
      const variable = type.variable;
      if (this.resolved.has(variable)) {
        const bounds = this.resolved.get(variable);
        if (!bounds) return null;
      }
      this.resolved.set(variable, null);
      return this.resolveSubtype(type.variable);
    }
    return type;
  }

  normalizeSupertype(type: Type): Type | null {
    if (typeof type === "object" && "and" in type) {
      const normalized = type.and.map((type) => this.normalizeSupertype(type));
      if (normalized.some((type) => !type)) return null;
      return { and: normalized as Type[] };
    }
    if (typeof type === "object" && "or" in type) {
      const normalized = type.or.map((type) => this.normalizeSupertype(type));
      if (normalized.some((type) => !type)) return null;
      return { or: normalized as Type[] };
    }
    if (typeof type === "object" && "not" in type) {
      const normalized = this.normalizeSupertype(type.not);
      if (!normalized) return null;
      return { not: normalized };
    }
    if (typeof type === "object" && "fn" in type) {
      const normalizedArg = this.normalizeSupertype(type.fn.arg);
      if (!normalizedArg) return null;
      const normalizedReturn = this.normalizeSubtype(type.fn.return);
      if (!normalizedReturn) return null;
      const normalizedClosure = type.fn.closure.map((t) => this.normalizeSupertype(t));
      if (normalizedClosure.some((type) => !type)) return null;
      return { fn: { arg: normalizedArg, return: normalizedReturn, closure: normalizedClosure as Type[] } };
    }
    if (typeof type === "object" && "variable" in type) {
      const variable = type.variable;
      if (this.resolved.has(variable)) {
        const bounds = this.resolved.get(variable);
        if (!bounds) return null;
      }
      this.resolved.set(variable, null);
      return this.resolveSupertype(type.variable);
    }
    return type;
  }

  normalizeType(type: Type): Type | null {
    if (typeof type === "object" && "and" in type) {
      const normalized = type.and.map((type) => this.normalizeType(type));
      if (normalized.some((type) => !type)) return null;
      return { and: normalized as Type[] };
    }
    if (typeof type === "object" && "or" in type) {
      const normalized = type.or.map((type) => this.normalizeType(type));
      if (normalized.some((type) => !type)) return null;
      return { or: normalized as Type[] };
    }
    if (typeof type === "object" && "not" in type) {
      const normalized = this.normalizeType(type.not);
      if (!normalized) return null;
      return { not: normalized };
    }
    if (typeof type === "object" && "fn" in type) {
      const normalizedArg = this.normalizeSubtype(type.fn.arg);
      if (!normalizedArg) return null;
      const normalizedReturn = this.normalizeSupertype(type.fn.return);
      if (!normalizedReturn) return null;
      const normalizedClosure = type.fn.closure.map((t) => this.normalizeSubtype(t));
      if (normalizedClosure.some((type) => !type)) return null;
      return { fn: { arg: normalizedArg, return: normalizedReturn, closure: normalizedClosure as Type[] } };
    }
    if (typeof type === "object" && "variable" in type) {
      const variable = type.variable;
      if (this.resolved.has(variable)) {
        const bounds = this.resolved.get(variable);
        if (!bounds) return null;
      }
      this.resolved.set(variable, null);
      return this.resolveExactType(variable);
    }
    return type;
  }

  unify(a: TypeBounds, b: Constraint): TypeBounds {
    assert(!("equals" in a));
    assert(!("equals" in b));
    if ("exactly" in b) {
      const type = this.normalizeType(b.exactly);
      const boundsType = a.exactly;
      if (!type) return a;
      if (!boundsType) return { ...a, exactly: type };
      if (typeof boundsType === "object" && "and" in boundsType) {
        return { ...a, exactly: { and: [...boundsType.and, type] } };
      }
      return { ...a, exactly: { and: [boundsType, type] } };
    }
    if ("subtype" in b) {
      const type = this.normalizeSubtype(b.subtype);
      const boundsType = a.subtype;
      if (!type) return a;
      if (!boundsType) return { ...a, subtype: type };
      if (typeof boundsType === "object" && "and" in boundsType) {
        return { ...a, subtype: { and: [...boundsType.and, type] } };
      }
      return { ...a, subtype: { and: [boundsType, type] } };
    }
    if ("supertype" in b) {
      const type = this.normalizeSupertype(b.supertype);
      const boundsType = a.supertype;
      if (!type) return a;
      if (!boundsType) return { ...a, supertype: type };
      if (typeof boundsType === "object" && "or" in boundsType) {
        return { ...a, supertype: { or: [...boundsType.or, type] } };
      }
      return { ...a, supertype: { or: [boundsType, type] } };
    }

    unreachable("cant unify");
  }

  resolve(variable: number): TypeBounds {
    if (this.resolved.has(variable)) {
      const bounds = this.resolved.get(variable);
      if (bounds) return bounds;
    }

    let bounds: TypeBounds = {};
    const constraints = this.constraints.get(variable);
    if (!constraints) {
      this.resolved.set(variable, bounds);
      return bounds;
    }

    this.resolved.set(variable, null);
    if (constraints.some((c) => "equals" in c)) {
      assert(constraints.length === 1);
      const otherConstraint = constraints[0];
      assert("equals" in otherConstraint);
      const otherVariable = otherConstraint.equals;
      if (this.resolved.has(variable)) {
        const bounds = this.resolved.get(variable);
        if (!bounds) return {};
      }
      return this.resolve(otherVariable);
    }

    for (const constraint of constraints) {
      bounds = this.unify(bounds, constraint);
    }

    this.resolved.set(variable, bounds);
    return bounds;
  }

  resolveSubtype(variable: number): Type {
    return this.boundsToSubtype(variable, this.resolve(variable));
  }

  resolveSupertype(variable: number): Type {
    return this.boundsToSupertype(variable, this.resolve(variable));
  }

  resolveExactType(variable: number): Type {
    return this.boundsToExactType(variable, this.resolve(variable));
  }

  addConstraint(variable: number, constraint: Constraint) {
    const constraints = this.constraints.get(variable);
    if (!constraints) {
      this.constraints.set(variable, [constraint]);
      return;
    }

    if ("equals" in constraint) {
      const otherVariable = constraint.equals;
      if (otherVariable === variable) return;

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
