import { NodeType, Tree } from "../../ast";
import { assert, nextId, unreachable } from "../../utils";

// subtype infers types that values must always satisfy (the actual values will be at least of these types)
// for example, if a parameter is only used as int (passed to a function that only accepts ints),
// then the type for the parameter will be int
// its value must inhabit the type
// if nothing can be inferred, then the type will be "unknown"

// supertype infers types that values will always satisfy (the actual values will be at most of these types)
// for example, if a function only called with ints, then the type for its arguments will be int

type Type =
  | "int"
  | "float"
  | "string"
  | "unknown"
  | "void"
  | "unit"
  | { atom: string }
  | { variable: number }
  | { fn: { arg: Type; return: Type } };

type Constraint = { subtype: Type } | { supertype: Type } | { equals: Type };
type TypeBounds = { supertype: Type; subtype: Type };
class Context {
  constraints: Map<number, Constraint[]> = new Map();
  bounds: Map<number, TypeBounds> = new Map();
  names: Map<string, Type> = new Map();
  constructor() {}

  resolve() {
    const types = new Map<number, TypeBounds>();
    console.log(this.constraints);

    this.constraints.forEach((constraints, variable) => {
      const constraint = constraints.find((constraint) => "equals" in constraint);
      if (!constraint) return;
      assert("equals" in constraint);
      const type = constraint.equals;

      if (!(typeof type === "object" && "variable" in type)) return;

      // variable is exactly equal to another variable `x`
      // then record type's variable is equal to`x`
      types.set(variable, { supertype: type, subtype: type });
      constraints.splice(constraints.indexOf(constraint), 1);

      // and move all constraints to `x`
      const otherConstraints = this.constraints.get(type.variable);
      if (otherConstraints) otherConstraints.push(...constraints);

      // and remove variable, since it is redundant now
      this.constraints.delete(variable);
    });

    this.constraints.forEach((constraints, variable) => {
      const constraint = constraints.find((constraint) => "subtype" in constraint);
      if (!constraint) return;
      assert("subtype" in constraint);
      const type = constraint.subtype;

      if (!(typeof type === "object" && "variable" in type)) return;

      // variable is a subtype of another variable `x`
      // then record type's variable is a supertype of `x`
      types.set(variable, { supertype: type, subtype: type });
      constraints.splice(constraints.indexOf(constraint), 1);

      // and move all constraints to `x`
      const otherConstraints = this.constraints.get(type.variable);
      if (otherConstraints) otherConstraints.push(...constraints);

      // and remove variable, since it is redundant now
      this.constraints.delete(variable);
    });

    console.log(types);
  }

  addConstraint(variable: number, constraint: Constraint) {
    const constraints = this.constraints.get(variable);
    if (!constraints) this.constraints.set(variable, [constraint]);
    else constraints.push(constraint);
  }
}

// is `a` a subtype of `b`? `a <: b` == true
// the bottom type must always be a subtype of the top type
const compareTypes = (a: Type, b: Type): boolean => {
  if (b === "unknown") return true;
  if (a === "void") return true;
  return true;
};

const infer = (ast: Tree, context: Context): Type => {
  const type = (() => {
    switch (ast.type) {
      case NodeType.NUMBER:
        if (Number.isInteger(ast.data.value)) return "int";
        else return "float";
      case NodeType.STRING:
        return "string";
      case NodeType.ATOM:
        return { atom: ast.data.value };
      case NodeType.UNIT:
        return "unit";
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
        const argType = { variable: nextId() };
        const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
        const prevNameType = context.names.get(name);
        if (name) context.names.set(name, argType);

        const returnType = infer(ast.children[1], context);

        if (prevNameType) context.names.set(name, prevNameType);
        else context.names.delete(name);

        return { fn: { arg: argType, return: returnType } };
      }
      case NodeType.APPLICATION: {
        const argType = infer(ast.children[1], context);
        const returnType = { variable: nextId() };
        const fnType = { fn: { arg: argType, return: returnType } };
        constrain(ast.children[0], context, fnType);
        console.dir([ast, fnType, context], { depth: null });

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
  ast.data.type = type;
  // context.addConstraint(ast.id, { equals: type });
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
      const argType = expectedType.fn.arg;
      const returnType = expectedType.fn.return;

      const name = ast.children[0].type === NodeType.NAME ? ast.children[0].data.value : null;
      const prevNameType = context.names.get(name);
      if (name) context.names.set(name, argType);

      constrain(ast.children[1], context, returnType);

      if (prevNameType) context.names.set(name, prevNameType);
      else context.names.delete(name);
      ast.data.type = expectedType;
      return;
    }
    case NodeType.APPLICATION: {
      const argType = infer(ast.children[1], context);
      const fnType = { fn: { arg: argType, return: expectedType } };
      constrain(ast.children[0], context, fnType);
      return;
    }
  }
  infer(ast, context);
  context.addConstraint(ast.id, { equals: expectedType });
};

const substituteConstraints = (ast: Tree, context: Context): void => {
  ast.children.forEach((child) => substituteConstraints(child, context));
  const variable = ast.id;
  const constraint = context.constraints.get(variable)?.find((constraint) => "equals" in constraint);
  if (!("type" in ast.data)) {
    if (constraint) {
      assert("equals" in constraint);
      ast.data.type = constraint.equals;
      context.constraints.delete(variable);
    }
  }
};

export const inferTypes = (ast: Tree): void => {
  const context = new Context();
  infer(ast, context);
  context.resolve();
  substituteConstraints(ast, context);
  // inferTopTypes(ast, context);
  // inferBottomTypes(ast, context);
};
