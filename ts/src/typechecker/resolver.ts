import { AbstractSyntaxTree } from "../parser/ast";
import { matchString, templateString } from "../parser/string";
import { Scope } from "../scope";
import { mapField, setField } from "../utils";

const getScope = (tree: AbstractSyntaxTree): Scope<{}> => {
  const traverse = (tree: AbstractSyntaxTree, scope = new Scope<{}>()) => {
    // console.dir({ msg: "getScope traverse", tree, scope }, { depth: null });
    if (tree.name === "name") {
      const name = tree.value;
      if (!scope.has({ name })) scope = scope.add(name, {});
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
  tree = mapField(["data", "scope"], (_scope) => _scope?.append(scope) ?? scope)(tree);
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

  if (matchString(tree, "_ is _ and _")[0]) {
    const { value, pattern, rest } = matchString(tree, "value is pattern and rest")[1];
    const valueScoped = resolve(value, scope);
    const patternScoped = resolve(pattern, scope, true);
    const restScoped = resolve(rest, scope.append(getScope(patternScoped)));
    tree = setField(["children", 1], restScoped)(tree);
    tree = setField(["children", 0, "children", 0, "children", 0], valueScoped)(tree);
    tree = setField(["children", 0, "children", 0, "children", 1], patternScoped)(tree);
    tree = mapField(["children", 0, "data", "scope"], (_scope) => _scope?.append(scope) ?? scope)(tree);
    tree = mapField(["children", 0, "children", 0, "data", "scope"], (_scope) => _scope?.append(scope) ?? scope)(tree);
    return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
  }

  if (tree.name === "name" && !pattern) {
    const index = scope.getByName(tree.value)?.relativeIndex ?? -1;
    return setField(["data", "relativeIndex"], index)(tree);
  }

  if (matchString(tree, "#_")[0] && tree.children[0].name === "int") {
    // @ts-ignore
    tree = mapField(["children", 0, "data", "scope"], (_scope) => _scope?.append(scope) ?? scope)(tree);
    const relativeIndex = tree.children[0].value;
    return setField(["data", "relativeIndex"], relativeIndex)(tree);
  }

  if (matchString(tree, "#_")[0]) {
    const child = tree.children[0];
    const childScoped = resolve(child, scope);

    if (childScoped.data.relativeIndex !== undefined) {
      tree = setField(["children", 0], childScoped)(tree);
      return setField(["data", "relativeIndex"], childScoped.data.relativeIndex + 1)(tree);
    }
  }

  if (pattern) {
    if (matchString(tree, "_ _")[0]) {
      const [left, right] = tree.children;
      const leftScoped = resolve(left, scope, true);
      const rightScope = scope.append(getScope(leftScoped));
      const rightScoped = resolve(right, rightScope, true);
      tree = setField(["children", 0], leftScoped)(tree);
      tree = setField(["children", 1], rightScoped)(tree);
      return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
    }

    if (matchString(tree, "_, _")[0]) {
      const [left, right] = tree.children;
      const leftScoped = resolve(left, scope, true);
      const rightScope = scope.append(getScope(leftScoped));
      const rightScoped = resolve(right, rightScope, true);
      tree = setField(["children", 0], leftScoped)(tree);
      tree = setField(["children", 1], rightScoped)(tree);
      return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
    }

    if (matchString(tree, "_ and _")[0]) {
      const [left, right] = tree.children;
      const leftScoped = resolve(left, scope, true);
      const rightScoped = resolve(right, scope.append(getScope(leftScoped)), true);
      tree = setField(["children", 0], leftScoped)(tree);
      tree = setField(["children", 1], rightScoped)(tree);
      return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
    }
  }

  tree = mapField(["children"], (children) => {
    const [childrenScoped, _] = children.reduce(
      ([children, scope], child) => {
        const childScoped = resolve(child, scope, pattern);
        return [[...children, childScoped], childScoped.data.scope];
      },
      [[], scope]
    );
    return childrenScoped;
  })(tree);
  return tree as AbstractSyntaxTree<T & { scope: Scope<{}> }>;
};
