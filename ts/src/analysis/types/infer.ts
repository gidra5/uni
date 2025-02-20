import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast";
import { assert, nextId, unreachable } from "../../utils";
import { inject, Injectable } from "../../utils/injector";
import { UnificationTable } from "./unification";
import { PhysicalType, Type } from "./utils";
import { Binding, resolve } from "../scope";

export type TypeSchema = Map<number, Type>;
export type PhysicalTypeSchema = Map<number, PhysicalType>;

// subtype infers types that values must always satisfy (the actual values will be at least of these types)
// for example, if a parameter is only used as int (passed to a function that only accepts ints),
// then the type for the parameter will be int
// its value must inhabit the type
// if nothing can be inferred, then the type will be "unknown"

// supertype infers types that values will always satisfy (the actual values will be at most of these types)
// for example, if a function only called with ints, then the type for its arguments will be int

const scope = [
  ["print_int", { fn: { arg: "int", return: "int" } }],
  ["print_string", { fn: { arg: "string", return: "string" } }],
  ["print_float", { fn: { arg: "float", return: "float" } }],
  ["print_symbol", { fn: { arg: "symbol", return: "symbol" } }],
  ["true", "boolean"],
  ["false", "boolean"],
] as const satisfies [string, Type][];

export const globalResolvedNames = Iterator.iter(scope)
  .map<Binding>(([name]) => [name, nextId()])
  .toMap();
export const globalResolvedNamesArray = [...globalResolvedNames.entries()];

const globalNames = new Map<number, Type>(scope.map(([name, type]) => [globalResolvedNames.get(name)!, type]));

export class Context {
  unificationTable = new UnificationTable();
  names: Map<number, Type> = globalNames;
  constructor() {}

  bind(ast: Tree, f: (argType: Type) => Type): Type {
    const argType = inferPattern(ast);
    const name = inject(Injectable.NodeToVariableMap).get(ast.children[0].id)!;
    this.names.set(name, argType);
    const t = f(argType);
    this.names.delete(name);
    return t;
  }
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

const inferPattern = (a: Tree): Type => {
  switch (a.type) {
    case NodeType.NAME:
      if (a.data.value === "void") return "void";
      if (a.data.value === "unknown") return "unknown";
      if (a.data.value === "int") return "int";
      if (a.data.value === "float") return "float";
      if (a.data.value === "string") return "string";
      if (a.data.value === "bool") return "boolean";
      return { variable: a.id };
    case NodeType.LABEL:
      return inferPattern(a.children[1]);
    case NodeType.FUNCTION:
      return { fn: { arg: inferPattern(a.children[0]), return: inferPattern(a.children[1]) } };
    default:
      unreachable("cant infer type");
  }
};

export const infer = (ast: Tree, context: Context): Type => {
  console.dir({ log: 1, context, ast }, { depth: null });

  switch (ast.type) {
    case NodeType.NUMBER: {
      const type = Number.isInteger(ast.data.value) ? "int" : "float";
      context.unificationTable.addConstraint(ast.id, { exactly: type });
      return type;
    }
    case NodeType.STRING:
      context.unificationTable.addConstraint(ast.id, { exactly: "string" });
      return "string";
    case NodeType.NAME: {
      const name = inject(Injectable.NodeToVariableMap).get(ast.id)!;
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
    case NodeType.DELIMITED_APPLICATION:
    case NodeType.APPLICATION: {
      infer(ast.children[0], context);
      const arg_type = infer(ast.children[1], context);
      const return_type: Type = { variable: ast.id };

      context.unificationTable.addConstraint(ast.id, { exactly: return_type });
      context.unificationTable.addConstraint(ast.children[0].id, {
        exactly: { fn: { arg: arg_type, return: return_type } },
      });

      return return_type;
    }
    case NodeType.FUNCTION: {
      return context.bind(ast.children[0], (argType) => {
        const returnType = infer(ast.children[1], context);
        const type = { fn: { arg: argType, return: returnType } };
        context.unificationTable.addConstraint(ast.id, { exactly: type });
        return type;
      });
    }
    case NodeType.ADD: {
      context.unificationTable.addConstraint(ast.id, { exactly: "int" });
      return "int";
    }
    case NodeType.MODULE:
    default:
      unreachable(`cant infer top types ${ast.type}`);
  }
};

const constrain = (ast: Tree, context: Context, expectedType: Type): void => {};

export const inferPhysical = (typeMap: TypeSchema): PhysicalTypeSchema => {
  const physicalTypeMap: PhysicalTypeSchema = new Map();

  const translate = (type: Type, id?: number): PhysicalType => {
    if (type === "int") return { int: 32 };
    if (type === "float") return { float: 32 };
    if (type === "string") return { pointer: { int: 8 } };
    if (type === "void") return "void";
    if (type === "unknown") return "unknown";
    assert(typeof type === "object");

    // must be resolved by that point
    assert(!("variable" in type));
    assert(!("and" in type));

    if ("fn" in type) {
      const arg = translate(type.fn.arg);
      const returnType = translate(type.fn.return);
      const freeVars = (id && inject(Injectable.ClosureVariablesMap).get(id)) || [];
      assert(freeVars);
      const closure = freeVars.map((name) => {
        const type = typeMap.get(name)!;
        const physicalType = translate(type, name);
        physicalTypeMap.set(name, physicalType);
        return physicalType;
      });

      return { fn: { args: [arg], ret: returnType, closure } };
    }
    if ("atom" in type) return { int: 32 };

    unreachable("cant convert type to LLVM type");
  };

  typeMap.forEach((type, id) => {
    if (physicalTypeMap.has(id)) return;
    physicalTypeMap.set(id, translate(type, id));
  });

  return physicalTypeMap;
};

export const substituteConstraints = (ast: Tree, context: Context, map: TypeSchema = new Map()): TypeSchema => {
  if (map.has(ast.id)) return map;
  switch (ast.type) {
    case NodeType.FUNCTION: {
      substituteConstraints(ast.children[1], context, map);
      map.set(ast.id, context.unificationTable.resolveType(ast.id));
      return map;
    }
    default: {
      ast.children.forEach((child) => substituteConstraints(child, context, map));
      map.set(ast.id, context.unificationTable.resolveType(ast.id));
      return map;
    }
  }
};

export const inferTypes = (ast: Tree): TypeSchema => {
  const context = new Context();
  resolve(ast, globalResolvedNamesArray);
  infer(ast, context);
  context.unificationTable.truncateTautologies();
  return substituteConstraints(ast, context);
  // console.dir(
  //   {
  //     // ast,
  //     table: context.unificationTable,
  //     // types: inject(Injectable.TypeMap),
  //     closures: inject(Injectable.ClosureVariablesMap),
  //     bound: inject(Injectable.BoundVariablesMap),
  //     nodeToVariable: inject(Injectable.NodeToVariableMap),
  //   },
  //   { depth: null }
  // );
  // inferPhysical();
};
