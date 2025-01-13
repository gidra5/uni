import fc from "fast-check";
import { assert, clamp } from "../../utils";
import { Type } from "./infer";

export const compareByList = (list: string[]) => (x: string, y: string) =>
  clamp(list.indexOf(x) - list.indexOf(y), -1, 1);
const canonicalLiteralTypesOrder = compareByList(["int", "float", "string", "unknown", "void"]);
const canonicalComplexTypesOrder = compareByList(["fn", "and", "or", "not", "variable"]);
const canonicalTypeofOrder = compareByList(["string", "object"]);

export const compareTypes = (a: Type, b: Type): number => {
  const typeofCompare = canonicalTypeofOrder(typeof a, typeof b);
  if (typeofCompare !== 0) return typeofCompare;

  if (typeof a === "string") {
    assert(typeof b === "string");
    return canonicalLiteralTypesOrder(a, b);
  }
  assert(typeof b === "object");

  const aKind = Object.keys(a)[0];
  const bKind = Object.keys(b)[0];
  if (aKind !== bKind) return canonicalComplexTypesOrder(aKind, bKind);

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
      const andCompare = clamp(a.and.length - b.and.length, -1, 1);
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
      const orCompare = clamp(a.or.length - b.or.length, -1, 1);
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
      return clamp(a.variable - b.variable, -1, 1);
    }
  }

  return 0;
};

export const isTypeEqual = (a: Type, b: Type): boolean => compareTypes(a, b) === 0;

export const isTypeReferenceVariable = (variable: number, type: Type): boolean => {
  if (typeof type !== "object") return false;
  if ("variable" in type && type.variable === variable) return true;
  if ("fn" in type) {
    const arg = type.fn.arg;
    const returnType = type.fn.return;
    return isTypeReferenceVariable(variable, arg) || isTypeReferenceVariable(variable, returnType);
  }
  if ("and" in type) {
    for (const t of type.and) {
      if (isTypeReferenceVariable(variable, t)) return true;
    }
    return false;
  }
  if ("or" in type) {
    for (const t of type.or) {
      if (isTypeReferenceVariable(variable, t)) return true;
    }
    return false;
  }
  if ("not" in type) {
    return isTypeReferenceVariable(variable, type.not);
  }
  return false;
};

export const replaceTypeVariable = (type: Type, variable: number, otherVariable: number) => {
  if (typeof type !== "object") return type;
  if ("variable" in type && type.variable === variable) {
    return { variable: otherVariable };
  }
  if ("fn" in type) {
    const arg = type.fn.arg;
    const returnType = type.fn.return;
    const closure = type.fn.closure.map((t) => replaceTypeVariable(t, variable, otherVariable));
    return {
      fn: {
        arg: replaceTypeVariable(arg, variable, otherVariable),
        return: replaceTypeVariable(returnType, variable, otherVariable),
        closure,
      },
    };
  }
  if ("and" in type) {
    return { and: type.and.map((t) => replaceTypeVariable(t, variable, otherVariable)) };
  }
  if ("or" in type) {
    return { or: type.or.map((t) => replaceTypeVariable(t, variable, otherVariable)) };
  }
  if ("not" in type) {
    return { not: replaceTypeVariable(type.not, variable, otherVariable) };
  }
  return type;
};

export const typeArb = fc.letrec<{ type: Type }>((typeArb) => ({
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

export const typeWithVariablesArb = (variables: number[]) =>
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
