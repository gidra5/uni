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
      const bound = resolveBindings(ast.children[0]);
      names = [...names, ...bound];
      const boundVariables = bound.map(([, id]) => id);
      inject(Injectable.BoundVariablesMap).set(ast.children[1].id, boundVariables);

      const freeVars = exclude(resolve(ast.children[1], names), boundVariables);
      inject(Injectable.ClosureVariablesMap).set(ast.id, freeVars);

      return freeVars;
    }
    default:
      return unique(ast.children.flatMap((child) => resolve(child, names)));
  }
};
