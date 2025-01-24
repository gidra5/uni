import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast";
import { nextId, unreachable } from "../../utils";
import { inject, Injectable } from "../../utils/injector";
import { UnificationTable } from "./unification";
import { Type } from "./utils";
import { structuralSimplify } from "./simplify";

// subtype infers types that values must always satisfy (the actual values will be at least of these types)
// for example, if a parameter is only used as int (passed to a function that only accepts ints),
// then the type for the parameter will be int
// its value must inhabit the type
// if nothing can be inferred, then the type will be "unknown"

// supertype infers types that values will always satisfy (the actual values will be at most of these types)
// for example, if a function only called with ints, then the type for its arguments will be int

const initialNames = new Map<string, Type>([
  [
    "print",
    {
      and: [
        { fn: { arg: "int", return: "int", closure: [] } },
        { fn: { arg: "float", return: "float", closure: [] } },
        { fn: { arg: "string", return: "string", closure: [] } },
      ],
    },
  ],
]);

export class Context {
  unificationTable = new UnificationTable();
  names: Map<string, Type> = initialNames;
  constructor() {}
}

// is `a` a subtype of `b`? `a <: b` == true
// the bottom type must always be a subtype of the top type
export const isSubtype = (a: Type, b: Type): boolean => {
  // console.log(a, b);
  if (a === b) return true;

  if (typeof b === "object" && "not" in b) return !isSubtype(b.not, a);
  if (typeof a === "object" && "not" in a) return !isSubtype(b, a.not);

  if (a === "void") return true;
  if (b === "unknown") return true;

  if (typeof a === "object" && "and" in a) {
    return a.and.some((type) => isSubtype(type, b));
    // // console.log(a, b);
    // const x = a.and.map((type) => isSubtype(type, b));
    // // console.log(3, x);
    // return x.some((x) => x);
  }
  if (typeof b === "object" && "and" in b) {
    return b.and.every((type) => isSubtype(a, type));
    // // console.log(a, b);
    // const x = b.and.map((type) => isSubtype(a, type));
    // // console.log(4, x);
    // return x.every((x) => x);
  }

  if (typeof a === "object" && "or" in a) {
    return a.or.every((type) => isSubtype(type, b));
    // console.log(a, b);
    // const x = a.or.map((type) => isSubtype(type, b));
    // console.log(2, x);
    // return x.every((x) => x);
  }
  if (typeof b === "object" && "or" in b) {
    return b.or.some((type) => isSubtype(a, type));
    // console.log(a, b);
    // const x = b.or.map((type) => isSubtype(a, type));
    // console.log(1, x);

    // return x.some((x) => x);
  }

  if (typeof a === "object" && "fn" in a) {
    if (!(typeof b === "object" && "fn" in b)) return false;
    return isSubtype(b.fn.arg, a.fn.arg) && isSubtype(a.fn.return, b.fn.return);
  }
  if (typeof b === "object" && "fn" in b) return false;

  if (typeof a === "object" && "variable" in a) {
    if (typeof b === "object" && "variable" in b) return a.variable === b.variable;
    return false;
  }
  if (typeof b === "object" && "variable" in b) return false;

  if (typeof a === "object" && "record" in a) {
    if (!(typeof b === "object" && "record" in b)) return false;
    if (b.record.length === 0) return true;
    if (b.record.length > a.record.length) return false;
    if (a.labels) {
      if (!b.labels) return false;
      const bMap = Iterator.iter(b.labels).zip(b.record).toMap();
      return Iterator.iter(a.labels)
        .zip(a.record)
        .every(([label, type]) => bMap.has(label) && isSubtype(type, bMap.get(label)!));
    }
    return Iterator.iter(a.record)
      .zip(b.record)
      .every(([a, b]) => isSubtype(a, b));
  }

  return false;
};

export const isSubtypeEqual = (a: Type, b: Type): boolean => isSubtype(a, b) && isSubtype(b, a);

export const infer = (ast: Tree, context: Context): Type => {
  // console.dir({ log: 1, context, ast }, { depth: null });

  switch (ast.type) {
    case NodeType.NUMBER:
      const type = Number.isInteger(ast.data.value) ? "int" : "float";
      context.unificationTable.addConstraint(ast.id, { exactly: type });
      return type;
    case NodeType.STRING:
      context.unificationTable.addConstraint(ast.id, { exactly: "string" });
      return "string";
    case NodeType.NAME: {
      const name = ast.data.value;
      const type = context.names.get(name);
      if (type) context.unificationTable.addConstraint(ast.id, { exactly: type });
      else context.names.set(name, { variable: ast.id });
      return type ?? { variable: ast.id };
    }
    case NodeType.SCRIPT:
    case NodeType.SEQUENCE: {
      const types = ast.children.map((child) => infer(child, context));
      context.unificationTable.addConstraint(ast.id, { equals: ast.children[types.length - 1].id });
      return types[types.length - 1];
    }
    case NodeType.FUNCTION: {
      const argType = { variable: nextId() };
      const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
      const prevNameType = context.names.get(name);
      if (name) context.names.set(name, argType);

      const returnType = infer(ast.children[1], context);

      if (prevNameType) context.names.set(name, prevNameType);
      else context.names.delete(name);

      const closure = [];
      context.unificationTable.addConstraint(ast.id, {
        exactly: { fn: { arg: argType, return: returnType, closure } },
      });
      return { fn: { arg: argType, return: returnType, closure } };
    }
    case NodeType.DELIMITED_APPLICATION:
    case NodeType.APPLICATION: {
      const argType = infer(ast.children[1], context);
      const returnType = { variable: nextId() };
      const fnType = { fn: { arg: argType, return: returnType, closure: [] } };
      constrain(ast.children[0], context, fnType);

      context.unificationTable.addConstraint(ast.id, { exactly: returnType });
      context.unificationTable.addConstraint(ast.children[0].id, { selectArg: argType });
      return returnType;
    }
    case NodeType.ADD: {
      const firstType = infer(ast.children[0], context);
      ast.children.forEach((child) => constrain(child, context, firstType));

      context.unificationTable.addConstraint(ast.id, { exactly: firstType });
      return firstType;
    }
    case NodeType.MODULE:
    default:
      unreachable(`cant infer top types ${ast.type}`);
  }
};

const constrain = (ast: Tree, context: Context, expectedType: Type): void => {
  // console.dir({ log: 2, expectedType, ast }, { depth: null });

  switch (ast.type) {
    case NodeType.NUMBER: {
      const type = Number.isInteger(ast.data.value) ? "int" : "float";
      if (isSubtype(expectedType, type)) return;
      break;
    }
    case NodeType.STRING:
      if (isSubtype(expectedType, "string")) return;
      break;
    case NodeType.NAME: {
      const type = infer(ast, context);
      if (type) {
        if (isSubtype(expectedType, type)) return;
        context.unificationTable.addConstraint(ast.id, { exactly: expectedType });
        return;
      }
      break;
    }
    case NodeType.FUNCTION: {
      if (!(typeof expectedType === "object" && "fn" in expectedType)) break;
      const argType = expectedType.fn.arg;
      const returnType = expectedType.fn.return;

      const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
      const prevNameType = context.names.get(name);
      if (name) context.names.set(name, argType);

      constrain(ast.children[1], context, returnType);

      if (prevNameType) context.names.set(name, prevNameType);
      else context.names.delete(name);
      context.unificationTable.addConstraint(ast.id, { exactly: expectedType });
      return;
    }
    case NodeType.APPLICATION: {
      const argType = infer(ast.children[1], context);
      const fnType = { fn: { arg: argType, return: expectedType, closure: [] } };
      constrain(ast.children[0], context, fnType);
      context.unificationTable.addConstraint(ast.id, { exactly: expectedType });
      context.unificationTable.addConstraint(ast.children[0].id, { selectArg: argType });
      return;
    }
  }
  infer(ast, context);
  context.unificationTable.addConstraint(ast.id, { exactly: expectedType });
};

export const substituteConstraints = (ast: Tree, context: Context): void => {
  ast.children.forEach((child) => substituteConstraints(child, context));
  const map = inject(Injectable.TypeMap);
  if (map.has(ast.id)) return;
  // console.log(ast.id);

  map.set(ast.id, context.unificationTable.resolveType(ast.id));
};

export const inferTypes = (ast: Tree): void => {
  const context = new Context();
  infer(ast, context);
  substituteConstraints(ast, context);
};
