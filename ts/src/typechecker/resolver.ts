import { AbstractSyntaxTree } from "../parser/ast";
import { matchString } from "../parser/string";
import { Scope } from "../scope";
import { mapField, setField } from "../utils";

const getScope = (tree: AbstractSyntaxTree): Scope<{}> => {
  const traverse = (tree: AbstractSyntaxTree, scope = new Scope<{}>()) => {
    // console.dir({ msg: "getScope traverse", tree, scope }, { depth: null });
    if (tree.name === "name") {
      const name = tree.value;
      scope = scope.add(name, {});
    }
    if (tree.name === "placeholder") {
      scope = scope.push({});
    }
    return tree.children.reduce((scope, child) => traverse(child, scope), scope);
  };
  return traverse(tree);
};

export const resolve = <T>(
  tree: AbstractSyntaxTree<T>,
  scope = new Scope<any>(),
  pattern = false
): AbstractSyntaxTree<T & { scope: Scope<{}>; relativeIndex?: number }> => {
  tree = setField(["data", "scope"], scope)(tree);
  // console.dir({ msg: "resolve", tree, scope }, { depth: null });

  /* function */
  if (matchString(tree, "_ -> _")[0] || matchString(tree, "fn _ -> _")[0]) {
    const [arg, ret] = tree.children;
    const argScoped = resolve(arg, scope, true);
    const retScope = scope.append(getScope(argScoped));
    const retScoped = resolve(ret, retScope);
    tree = setField(["children", 0], argScoped)(tree);
    tree = setField(["children", 1], retScoped)(tree);
    return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
  }

  if (tree.name === "name" && !pattern) {
    const index = scope.getByName(tree.value)?.relativeIndex ?? -1;
    return setField(["data", "relativeIndex"], index)(tree);
  }

  if (matchString(tree, "#_")[0] && tree.children[0].name === "int") {
    const relativeIndex = tree.children[0].value;
    return setField(["data", "relativeIndex"], relativeIndex)(tree);
  }

  if (pattern) {
    if (matchString(tree, "_ _")[0]) {
      const [left, right] = tree.children;
      const leftScoped = resolve(left, scope, true);
      const rightScope = scope.append(getScope(leftScoped));
      const rightScoped = resolve(right, rightScope);
      tree = setField(["children", 0], leftScoped)(tree);
      tree = setField(["children", 1], rightScoped)(tree);
      return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
    }
  }

  tree = mapField(["children"], (children) => children.map((child) => resolve(child, scope)))(tree);
  return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
};
