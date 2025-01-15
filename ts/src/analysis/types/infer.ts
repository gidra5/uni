import { NodeType, Tree } from "../../ast";
import { nextId, unreachable } from "../../utils";
import { inject, Injectable } from "../../utils/injector";
import { UnificationTable } from "./unification";

// subtype infers types that values must always satisfy (the actual values will be at least of these types)
// for example, if a parameter is only used as int (passed to a function that only accepts ints),
// then the type for the parameter will be int
// its value must inhabit the type
// if nothing can be inferred, then the type will be "unknown"

// supertype infers types that values will always satisfy (the actual values will be at most of these types)
// for example, if a function only called with ints, then the type for its arguments will be int

export type Type =
  | "int"
  | "float"
  | "string"
  | "unknown"
  | "void"
  | { variable: number }
  | { fn: { arg: Type; return: Type; closure?: Type[] } }
  | { and: Type[] }
  | { or: Type[] }
  | { not: Type };

const initialNames = new Map<string, Type>([
  [
    "print",
    {
      and: [
        { fn: { arg: "int", return: "int", closure: [] } },
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
  if (b === "unknown") return true;
  if (a === "void") return true;
  if (a !== b) return false;
  return true;
};

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
