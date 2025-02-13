import { NodeType, Tree } from "../ast";
import { assert, exclude, unique, unreachable } from "../utils";
import { inject, Injectable } from "../utils/injector";

export type Binding = [string, number];

const resolveBindings = (ast: Tree): Binding[] => {
  switch (ast.type) {
    case NodeType.NAME: {
      inject(Injectable.NodeToVariableMap).set(ast.id, ast.id);
      return [[ast.data.value, ast.id]];
    }
    case NodeType.LABEL:
      return resolveBindings(ast.children[0]);
    case NodeType.TUPLE:
      return ast.children.flatMap(resolveBindings);
    default:
      unreachable("cant resolve bindings");
  }
};

/** returns a list of free variables */
export const resolve = (ast: Tree, names: Binding[] = []): number[] => {
  switch (ast.type) {
    case NodeType.NAME: {
      const binding = names.findLast(([name]) => name === ast.data.value);
      assert(binding); // TODO: error reporting, undeclared variable
      inject(Injectable.NodeToVariableMap).set(ast.id, binding[1]);
      return [binding[1]];
    }
    case NodeType.FUNCTION: {
      const body = ast.children[ast.children.length - 1];
      const args = ast.children.slice(0, -1);
      const bound = args.flatMap(resolveBindings);
      names = [...names, ...bound];
      const boundVariables = bound.map(([, id]) => id);
      inject(Injectable.BoundVariablesMap).set(body.id, boundVariables);

      const freeVars = exclude(resolve(body, names), boundVariables);
      inject(Injectable.ClosureVariablesMap).set(ast.id, freeVars);

      return freeVars;
    }
    default:
      return unique(ast.children.flatMap((child) => resolve(child, names)));
  }
};
