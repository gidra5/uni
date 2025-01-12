import { assert, unreachable } from "../../utils";
import { Type } from "./infer";

export type Constraint = TableConstraint | { equals: number };
export type TypeBounds = { exactly: Type } | { equals: number };
type TableConstraint = { exactly: Type };

const canonicalLiteralTypesOrder = ["int", "float", "string", "unknown", "void"];
const canonicalComplexTypesOrder = ["fn", "and", "or", "not", "variable"];
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
    case "variable": {
      assert("variable" in a);
      assert("variable" in b);
      return a.variable - b.variable;
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
let i = 0;

export class UnificationTable {
  resolved: Map<number, TypeBounds> = new Map();
  resolving: Set<number> = new Set();

  constructor(public constraints: Map<number, TableConstraint[] | { equals: number }> = new Map()) {}

  boundsToType(variable: number, bounds: TypeBounds): Type {
    if ("equals" in bounds) {
      if (bounds.equals === variable) return { variable };
      return this.resolveType(bounds.equals);
    }
    const type = bounds.exactly ?? { variable };
    return type;
  }

  normalizeType(type: Type): Type {
    if (typeof type === "object" && "and" in type) {
      const normalized = type.and.map((type) => this.normalizeType(type));
      return { and: normalized as Type[] };
    }
    if (typeof type === "object" && "or" in type) {
      const normalized = type.or.map((type) => this.normalizeType(type));
      return { or: normalized as Type[] };
    }
    if (typeof type === "object" && "not" in type) {
      const normalized = this.normalizeType(type.not);
      return { not: normalized };
    }
    if (typeof type === "object" && "fn" in type) {
      const normalizedArg = this.normalizeType(type.fn.arg);
      const normalizedReturn = this.normalizeType(type.fn.return);
      const normalizedClosure = type.fn.closure.map((t) => this.normalizeType(t));
      return { fn: { arg: normalizedArg, return: normalizedReturn, closure: normalizedClosure as Type[] } };
    }
    if (typeof type === "object" && "variable" in type) {
      const variable = type.variable;
      if (this.resolving.has(variable)) return { variable };
      return this.resolveType(variable);
    }
    return type;
  }

  recursive(variable: number, type: Type): boolean {
    if (typeof type === "object" && "variable" in type && type.variable === variable) return true;
    if (typeof type === "object" && "fn" in type) {
      const arg = type.fn.arg;
      const returnType = type.fn.return;
      return this.recursive(variable, arg) || this.recursive(variable, returnType);
    }
    if (typeof type === "object" && "and" in type) {
      for (const t of type.and) {
        if (this.recursive(variable, t)) return true;
      }
      return false;
    }
    if (typeof type === "object" && "or" in type) {
      for (const t of type.or) {
        if (this.recursive(variable, t)) return true;
      }
      return false;
    }
    // if (typeof type === "object" && "not" in type) {
    //   return this.recursive(variable, type.not);
    // }
    return false;
  }

  unify(bounds: TypeBounds, constraint: Constraint): TypeBounds {
    // console.dir({ bounds, constraint }, { depth: null });

    assert(!("equals" in bounds));
    assert(!("equals" in constraint));
    if ("exactly" in constraint) {
      const type = this.normalizeType(constraint.exactly);
      const boundsType = bounds.exactly;
      if (boundsType === "unknown") return { ...bounds, exactly: type };
      if (typeof boundsType === "object" && "variable" in boundsType && !this.recursive(boundsType.variable, type)) {
        return { ...bounds, exactly: type };
      }
      if (boundsType === type) return bounds;
      if (typeof boundsType === "object" && "fn" in boundsType && typeof type === "object" && "fn" in type) {
        const x = this.unify({ exactly: boundsType.fn.arg }, { exactly: type.fn.arg });
        const y = this.unify({ exactly: boundsType.fn.return }, { exactly: type.fn.return });
        const z = boundsType.fn.closure.map((t, i) => this.unify({ exactly: t }, { exactly: type.fn.closure[i] }));

        return {
          exactly: {
            fn: {
              arg: this.boundsToType(0, x),
              return: this.boundsToType(0, y),
              closure: z.map((t) => this.boundsToType(0, t)),
            },
          },
        };
      }
      if (typeof boundsType === "object" && "and" in boundsType) {
        return { ...bounds, exactly: { and: [...boundsType.and, type] } };
      }
      return { ...bounds, exactly: { and: [boundsType, type] } };
    }

    unreachable("cant unify");
  }

  resolve(variable: number): TypeBounds {
    // console.log(variable);

    if (this.resolved.has(variable)) {
      const bounds = this.resolved.get(variable);
      if (bounds) return bounds;
    }

    this.resolving.add(variable);

    let bounds: TypeBounds = { exactly: { variable } };
    const constraints = this.constraints.get(variable);
    if (!constraints) {
      this.resolved.set(variable, bounds);
      this.resolving.delete(variable);
      return bounds;
    }

    if ("equals" in constraints) {
      if (this.resolving.has(constraints.equals)) {
        this.resolving.delete(variable);
        return bounds;
      }

      const resolved = this.resolve(constraints.equals);
      this.resolving.delete(variable);
      return resolved;
    }

    for (const constraint of constraints) {
      bounds = this.unify(bounds, constraint);
    }

    this.resolved.set(variable, bounds);
    this.resolving.delete(variable);
    // console.dir({ variable, bounds }, { depth: null });
    return bounds;
  }

  resolveType(variable: number): Type {
    return this.boundsToType(variable, this.resolve(variable));
  }

  addSecondaryConstraints(constraint1: Constraint, constraint2: Constraint) {
    // console.log(constraint1, constraint2);

    // i++;
    // if (i > 10) throw new Error("infinite loop");
    if ("exactly" in constraint1 && "exactly" in constraint2) {
      const type1 = constraint1.exactly;
      const type2 = constraint2.exactly;
      if (typeof type1 === "object" && typeof type2 === "object" && "fn" in type1 && "fn" in type2) {
        this.addSecondaryConstraints({ exactly: type1.fn.arg }, { exactly: type2.fn.arg });
        this.addSecondaryConstraints({ exactly: type1.fn.return }, { exactly: type2.fn.return });
      }
      if (typeof type1 === "object" && "variable" in type1) {
        this.addConstraint(type1.variable, constraint2);
      }
      if (typeof type2 === "object" && "variable" in type2) {
        this.addConstraint(type2.variable, constraint1);
      }
      return;
    }
    if ("equals" in constraint1) {
      this.addConstraint(constraint1.equals, constraint2);
      return;
    }
    if ("equals" in constraint2) {
      this.addConstraint(constraint2.equals, constraint1);
      return;
    }
  }

  addConstraint(variable: number, constraint: Constraint) {
    if ("exactly" in constraint && typeof constraint.exactly === "object" && "variable" in constraint.exactly) {
      this.addConstraint(variable, { equals: constraint.exactly.variable });
      return;
    }
    const constraints = this.constraints.get(variable);

    // console.dir([variable, constraint, constraints], { depth: null });

    if (!constraints) {
      if ("equals" in constraint) this.constraints.set(variable, constraint);
      else this.constraints.set(variable, [constraint]);

      this.truncate();
      return;
    }

    if ("equals" in constraints) {
      if (constraints.equals === variable) {
        if ("equals" in constraint) this.constraints.set(variable, constraint);
        else this.constraints.set(variable, [constraint]);

        this.truncate();
        return;
      }
      this.addConstraint(constraints.equals, constraint);
      return;
    }

    if ("equals" in constraint) {
      const otherVariable = constraint.equals;
      if (otherVariable === variable) return;

      const otherConstraints = this.constraints.get(otherVariable);
      if (otherConstraints && "equals" in otherConstraints && otherConstraints.equals === variable) return;

      for (const otherConstraint of [...constraints]) {
        this.addConstraint(otherVariable, otherConstraint);
      }

      this.constraints.set(variable, constraint);

      this.truncate();
      return;
    }

    if ("exactly" in constraint) {
      const otherConstraints = constraints.filter((c) => "exactly" in c);
      for (const otherConstraint of otherConstraints) {
        this.addSecondaryConstraints(constraint, otherConstraint);
      }
    }

    constraints.push(constraint);
    constraints.sort(compareConstraints);

    this.truncate();
  }

  replaceType(type: Type, variable: number, otherVariable: number) {
    if (typeof type === "object" && "variable" in type && type.variable === variable) {
      return { variable: otherVariable };
    }
    if (typeof type === "object" && "fn" in type) {
      const arg = type.fn.arg;
      const returnType = type.fn.return;
      return {
        fn: {
          arg: this.replaceType(arg, variable, otherVariable),
          return: this.replaceType(returnType, variable, otherVariable),
          closure: type.fn.closure,
        },
      };
    }
    if (typeof type === "object" && "and" in type) {
      return { and: type.and.map((t) => this.replaceType(t, variable, otherVariable)) };
    }
    if (typeof type === "object" && "or" in type) {
      return { or: type.or.map((t) => this.replaceType(t, variable, otherVariable)) };
    }
    // if (typeof type === "object" && "not" in type) {
    //   return { not: this.replaceType(type.not, variable, otherVariable) };
    // }
    return type;
  }

  replace(variable: number, otherVariable: number) {
    for (const [_variable, constraints] of this.constraints.entries()) {
      // console.dir(
      //   {
      //     _variable,
      //     constraints,
      //     variable,
      //     otherVariable,
      //   },
      //   { depth: null }
      // );
      if (_variable === variable) continue;
      if (!Array.isArray(constraints)) {
        if (constraints.equals === variable) {
          this.constraints.set(_variable, { equals: otherVariable });
        }
        continue;
      }

      for (const constraint of constraints) {
        constraint.exactly = this.replaceType(constraint.exactly, variable, otherVariable);
      }
    }
  }

  truncate() {
    for (const [variable, constraints] of this.constraints) {
      if (Array.isArray(constraints)) continue;
      const otherVariable = constraints.equals;
      this.replace(variable, otherVariable);
    }

    for (const [variable, constraints] of this.constraints) {
      if (!Array.isArray(constraints)) continue;
      const unique: TableConstraint[] = [];
      for (const constraint of constraints) {
        if (unique.some((x) => compareConstraints(x, constraint) === 0)) continue;
        unique.push(constraint);
      }

      this.constraints.set(variable, unique);
    }
  }

  truncateTautologies() {
    for (const [variable, constraints] of this.constraints) {
      if (Array.isArray(constraints)) continue;
      if (constraints.equals === variable) this.constraints.delete(variable);
    }
  }
}
