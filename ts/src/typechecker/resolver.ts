import { AbstractSyntaxTree } from "../parser/ast";
import { matchString } from "../parser/string";
import { Scope } from "../scope";
import { mapField, setField } from "../utils";

const collectScope = (pattern: AbstractSyntaxTree): string[] => {
  if (matchString(pattern, "_, _")[0]) {
    const [left, right] = pattern.children;
    return [...collectScope(left), ...collectScope(right)];
  }

  if (matchString(pattern, "..._")[0]) {
    return collectScope(pattern.children[0]);
  }

  return [];
};

export const resolve = <T>(
  tree: AbstractSyntaxTree<T>,
  scope = new Scope<any>()
): AbstractSyntaxTree<T & { scope: Scope<any> }> => {};
