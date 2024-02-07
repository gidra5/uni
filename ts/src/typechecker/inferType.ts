import { AbstractSyntaxTree, set } from "../parser/ast";
import { matchString } from "../parser/string";
import { Scope } from "../scope";
import { assert, setField } from "../utils";
import { inferScope } from "./inferScope";
import { simplifyType } from "./simplify";
import { bool, float, func, int, string, type, unit, unknown, value, voidType } from "./type";
import { Type, TypeScope } from "./types";

type InferTypeContext = {
  scope: TypeScope;
  inferredScope?: TypeScope;
  isBinding: boolean;
};

export type TypedAST<T = any> = AbstractSyntaxTree<T & { type: Type }>;

const getScopeBindings = (tree: TypedAST): TypeScope => {
  // console.dir({ msg: "getScopeBindings", tree }, { depth: null });
  const bindings: TypeScope = new Scope();
  const traverse = (tree: TypedAST) => {
    // console.dir({ msg: "getScopeBindings traverse", tree }, { depth: null });

    if (tree.name === "name") {
      const name = tree.value;
      const type = tree.data.type;
      bindings.add(name, type);
    }
    tree.children.forEach(traverse);
  };
  traverse(tree);
  return bindings;
};

const defaultContext = (): InferTypeContext => ({
  scope: new Scope({
    true: value({ kind: "bool", value: true }),
    false: value({ kind: "bool", value: false }),
  }),
  isBinding: false,
});

// infers types for a given tree
export const inferType = <T>(tree: AbstractSyntaxTree<T>, context = defaultContext()): TypedAST<T> => {
  // console.dir({ msg: "inferType", tree, context, stack: new Error().stack }, { depth: null });
  /* application */
  if (matchString(tree, "_ _")[0]) {
    const [func, arg] = tree.children;
    const funcTyped = inferType(func, context);
    const argTyped = inferType(arg, context);
    tree = setField(["children", 0], funcTyped)(tree);
    tree = setField(["children", 1], argTyped)(tree);
    const funcType = funcTyped.data.type;
    assert(funcType.argName === "function");
    return setField(["data", "type"], simplifyType(funcType.children[1]))(tree);
  }

  /* function */
  if (matchString(tree, "_ -> _")[0]) {
    const [arg, ret] = tree.children;
    const _ret = inferScope(ret);
    const inferredScope = _ret.data.scope;
    const argTyped = inferType(arg, { ...context, isBinding: true, inferredScope });
    const scope = context.scope.append(getScopeBindings(argTyped));
    const retTyped = inferType(_ret, { ...context, scope });
    tree = setField(["children", 0], argTyped)(tree);
    tree = setField(["children", 1], retTyped)(tree);
    const treeScoped = inferScope(tree);
    const _scope = treeScoped.data.scope;
    const implicitArgs = _scope.iter().map(({ value: type }) => ({ type, implicit: true }));
    // const type = func(argTyped.data.type, retTyped.data.type);
    let type = func(...implicitArgs, argTyped.data.type, retTyped.data.type);
    type = simplifyType(type);
    return setField(["data", "type"], type)(tree);
  }

  /* variable name */
  if (tree.name === "name") {
    const name = tree.value;
    let type = context.isBinding
      ? context.inferredScope?.getByName(name)?.value ?? unknown()
      : context.scope.getByName(name)?.value ?? voidType();
    type = simplifyType(type);
    // console.dir({ msg: "inferType name", name, type, tree, context }, { depth: null });

    return setField(["data", "type"], type)(tree);
  }

  /* literals */
  if (tree.name === "string") {
    return setField(["data", "type"], value({ kind: "string", value: tree.value }))(tree);
  }
  if (tree.name === "int") {
    return setField(["data", "type"], value({ kind: "int", value: tree.value }))(tree);
  }
  if (tree.name === "float") {
    return setField(["data", "type"], value({ kind: "float", value: tree.value }))(tree);
  }
  if (matchString(tree, "()")) {
    return setField(["data", "type"], unit())(tree);
  }
  if (matchString(tree, "{}")) {
    return setField(["data", "type"], voidType())(tree);
  }

  return setField(["data", "type"], unknown())(tree);
};
