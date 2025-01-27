import { NodeType, Tree } from "../ast";
import { exclude, unique } from "../utils";
import { inject, Injectable } from "../utils/injector";

export const free = (ast: Tree): string[] => {
  switch (ast.type) {
    case NodeType.NAME: {
      const freeVars = [ast.data.value];
      inject(Injectable.FreeVariablesMap).set(ast.id, freeVars);
      return freeVars;
    }
    case NodeType.FUNCTION: {
      const boundNames = bound(ast.children[0]);
      const boundVariablesMap = inject(Injectable.BoundVariablesMap);
      const otherBoundNames = boundVariablesMap.get(ast.id)!;
      boundVariablesMap.set(ast.children[1].id, unique(otherBoundNames.concat(boundNames)));

      const freeVars = exclude(free(ast.children[1]), boundNames);
      inject(Injectable.FreeVariablesMap).set(ast.id, freeVars);

      return freeVars;
    }
    default:
      return unique(ast.children.flatMap((child) => free(child)));
  }
};

const bound = (ast: Tree): string[] => {
  switch (ast.type) {
    case NodeType.NAME:
      return [ast.data.value];
    default:
      return unique(ast.children.flatMap((child) => bound(child)));
  }
};
