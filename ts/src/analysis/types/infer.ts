import { NodeType, Tree } from "../../ast";
import { assert, nextId, unreachable } from "../../utils";
import { UnificationTable } from "./unification";

// subtype infers types that values must always satisfy (the actual values will be at least of these types)
// for example, if a parameter is only used as int (passed to a function that only accepts ints),
// then the type for the parameter will be int
// its value must inhabit the type
// if nothing can be inferred, then the type will be "unknown"

// supertype infers types that values will always satisfy (the actual values will be at most of these types)
// for example, if a function only called with ints, then the type for its arguments will be int

export type Value = number;
// export type Value = number | string | { atom: string } | { type: Type };
// | { fn: { arg: Value; return: Value; closure: Value[] } }

export type Type =
  | "int"
  | "float"
  | "string"
  | "unknown"
  | "void"
  // | "unit"
  // | { value: Value }
  | { variable: number }
  | { fn: { arg: Type; return: Type; closure: Type[] } }
  | { and: Type[] }
  | { or: Type[] }
  | { not: Type };

class Context {
  unificationTable = new UnificationTable();
  names: Map<string, Type> = new Map([
    [
      "print",
      {
        and: [
          { fn: { arg: "int", return: "void", closure: [] } },
          { fn: { arg: "float", return: "void", closure: [] } },
          { fn: { arg: "string", return: "void", closure: [] } },
        ],
      } satisfies Type,
    ],
  ]);
  constructor() {}
}

// is `a` a subtype of `b`? `a <: b` == true
// the bottom type must always be a subtype of the top type
export const compareTypes = (a: Type, b: Type): boolean => {
  if (b === "unknown") return true;
  if (a === "void") return true;
  if (a !== b) return false;
  return true;
};

function collectFreeVars(ast: Tree): string[] {
  switch (ast.type) {
    case NodeType.NAME:
      return [ast.data.value];
    case NodeType.FUNCTION:
      const boundNames = collectBoundNames(ast.children[0]);
      const freeVars = collectFreeVars(ast.children[1]);
      return freeVars.filter((x) => !boundNames.includes(x));
    default:
      return ast.children.flatMap((child) => collectFreeVars(child));
  }
}

function collectBoundNames(ast: Tree): string[] {
  switch (ast.type) {
    case NodeType.NAME:
      return [ast.data.value];
    default:
      return ast.children.flatMap((child) => collectBoundNames(child));
  }
}

const infer = (ast: Tree, context: Context): Type => {
  const type = ((): Type => {
    switch (ast.type) {
      case NodeType.NUMBER:
        if (Number.isInteger(ast.data.value)) return "int";
        else return "float";
      case NodeType.STRING:
        return "string";
      // case NodeType.ATOM:
      //   return { atom: ast.data.value };
      // case NodeType.UNIT:
      //   return "unit";
      case NodeType.IMPLICIT_PLACEHOLDER:
      case NodeType.PLACEHOLDER:
        return "unknown";
      case NodeType.NAME: {
        const name = ast.data.value;
        const type = context.names.get(name);
        if (type) return type;
        return { variable: ast.id };
      }
      case NodeType.SCRIPT:
      case NodeType.SEQUENCE: {
        const types = ast.children.map((child) => infer(child, context));
        return types[types.length - 1];
      }
      case NodeType.FUNCTION: {
        const freeVars = collectFreeVars(ast);
        assert(freeVars.every((x) => context.names.has(x)));
        const argType = { variable: nextId() };
        const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
        const prevNameType = context.names.get(name);
        if (name) context.names.set(name, argType);

        const returnType = infer(ast.children[1], context);

        if (prevNameType) context.names.set(name, prevNameType);
        else context.names.delete(name);

        const closure = freeVars.map((name) => ({ name, type: context.names.get(name)! }));
        return { fn: { arg: argType, return: returnType, closure } };
      }
      case NodeType.DELIMITED_APPLICATION:
      case NodeType.APPLICATION: {
        const argType = infer(ast.children[1], context);
        const returnType = { variable: nextId() };
        const fnType = { fn: { arg: argType, return: returnType, closure: [] } };
        constrain(ast.children[0], context, fnType);
        // console.dir([ast, fnType, context], { depth: null });

        return returnType;
      }
      case NodeType.ADD: {
        const firstType = infer(ast.children[0], context);
        ast.children.forEach((child) => constrain(child, context, firstType));
        return firstType;
      }
      case NodeType.MULT: {
        // every child is subtype of int
        const ints = ast.children.every((child) => compareTypes(infer(child, context), "int"));
        return ints ? "int" : "float";
      }
      case NodeType.MODULE:
      default:
        unreachable("cant infer top types");
    }
  })();
  context.unificationTable.addConstraint(ast.id, { equals: type });
  return type;
};

const constrain = (ast: Tree, context: Context, expectedType: Type): void => {
  switch (ast.type) {
    case NodeType.NUMBER: {
      if (Number.isInteger(ast.data.value)) {
        if (compareTypes(expectedType, "int")) return;
      } else {
        if (compareTypes(expectedType, "float")) return;
      }
      break;
    }
    case NodeType.STRING:
      if (compareTypes(expectedType, "string")) return;
      break;
    case NodeType.ATOM:
      if (compareTypes(expectedType, { atom: ast.data.value })) return;
      break;
    case NodeType.UNIT:
      if (compareTypes(expectedType, "unit")) return;
      break;
    case NodeType.IMPLICIT_PLACEHOLDER:
    case NodeType.PLACEHOLDER:
      if (compareTypes(expectedType, "unknown")) return;
      break;
    case NodeType.FUNCTION: {
      if (!(typeof expectedType === "object" && "fn" in expectedType)) break;
      const freeVars = collectFreeVars(ast);
      const argType = expectedType.fn.arg;
      const returnType = expectedType.fn.return;

      const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
      const prevNameType = context.names.get(name);
      if (name) context.names.set(name, argType);

      constrain(ast.children[1], context, returnType);

      if (prevNameType) context.names.set(name, prevNameType);
      else context.names.delete(name);
      const closure = freeVars.map((name) => ({ name, type: context.names.get(name)! }));
      expectedType.fn.closure = closure;
      context.unificationTable.addConstraint(ast.id, { equals: expectedType });
      return;
    }
    case NodeType.APPLICATION: {
      const argType = infer(ast.children[1], context);
      const fnType = { fn: { arg: argType, return: expectedType, closure: [] } };
      constrain(ast.children[0], context, fnType);
      context.unificationTable.addConstraint(ast.id, { equals: expectedType });
      return;
    }
  }
  infer(ast, context);
  context.unificationTable.addConstraint(ast.id, { equals: expectedType });
};

const substituteConstraints = (ast: Tree, context: Context): void => {
  ast.children.forEach((child) => substituteConstraints(child, context));
  const variable = ast.id;
  const type = context.unificationTable.resolve(variable);
  if (!("type" in ast.data)) {
    if (type) {
      assert("equals" in type);
      ast.data.type = type.equals;
    }
  }
};

export const inferTypes = (ast: Tree): void => {
  const context = new Context();
  infer(ast, context);
  // console.dir([context.constraints, context.bounds], { depth: null });
  substituteConstraints(ast, context);
};
