import { AbstractSyntaxTree } from "../parser/ast";
import { matchString } from "../parser/string";
import { assert, setField } from "../utils";
import { bool, func, number, string, unit, voidType } from "./type";
import { Type } from "./types";

type InferTypeContext = {
  variables: { [key: string]: Type };
};

const defaultContext = (): InferTypeContext => ({
  variables: {
    true: bool(),
    false: bool(),
  },
});

// infers types for a given tree
export const inferType = <T>(
  tree: AbstractSyntaxTree<T>,
  context = defaultContext()
): AbstractSyntaxTree<T & { type: Type }> => {
  // console.dir({ msg: "inferType", tree, context, stack: new Error().stack }, { depth: null });
  /* application */
  if (matchString(tree, "_ _")[0]) {
    const [func, arg] = tree.children;
    const funcTyped = inferType(func, context);
    const argTyped = inferType(arg, context);
    tree = setField(["children", 0], funcTyped)(tree);
    tree = setField(["children", 1], argTyped)(tree);
    const funcType = funcTyped.data.type;
    assert(funcType.kind === "function");
    return setField(["data", "type"], funcType.types[1])(tree);
  }

  /* function */
  if (matchString(tree, "_ -> _")[0]) {
    const [arg, ret] = tree.children;
    const argTyped = inferType(arg, context);
    const retTyped = inferType(ret, context);
    tree = setField(["children", 0], argTyped)(tree);
    tree = setField(["children", 1], retTyped)(tree);
    return setField(["data", "type"], func(argTyped.data.type, retTyped.data.type))(tree);
  }

  /* variable name */
  if (matchString(tree, "name")[0]) {
    const name = tree.value;
    return setField(["data", "type"], context.variables[name] ?? voidType())(tree);
  }

  /* literals */
  if (tree.name === "string") {
    return setField(["data", "type"], string())(tree);
  }
  if (tree.name === "number") {
    return setField(["data", "type"], number())(tree);
  }
  if (matchString(tree, "()")) {
    return setField(["data", "type"], unit())(tree);
  }
  if (matchString(tree, "{}")) {
    return setField(["data", "type"], voidType())(tree);
  }

  return tree as AbstractSyntaxTree<T & { type: Type }>;
};
