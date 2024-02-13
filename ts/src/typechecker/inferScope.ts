import { AbstractSyntaxTree } from "../parser/ast.js";
import { matchString } from "../parser/string.js";
import { Scope } from "../scope.js";
import { setField } from "../utils/index.js";
import { and, bool, func, index, type, unknown } from "./type.js";
import { Type, TypeScope } from "./types.js";
import { simplifyType } from "./simplify.js";

type InferTypeContext = {
  scope: TypeScope;
  minimalType: Type;
  isBinding: boolean;
};

const defaultContext = (): InferTypeContext => ({
  scope: new Scope({
    true: bool(),
    false: bool(),
  }),
  minimalType: unknown(),
  isBinding: false,
});

// infers names and minimal interface for them for a given tree
export const inferScope = <T>(
  tree: AbstractSyntaxTree<T>,
  context: InferTypeContext = defaultContext()
): AbstractSyntaxTree<T & { scope: TypeScope }> => {
  // console.dir({ msg: "inferScope", tree, context, stack: new Error().stack }, { depth: null });
  /* application */
  // if (matchString(tree, "_ _")[0]) {
  //   const scope = new Scope();
  //   const [fn, arg] = tree.children;
  //   const typeVar1Index = scope.push(type());
  //   const typeVar2Index = scope.push(type());
  //   const minimalFnType = func(index(typeVar1Index), index(typeVar2Index));
  //   const minimalArgType = index(typeVar1Index);
  //   const fnScoped = inferScope(fn, { ...context, minimalType: minimalFnType });
  //   const argScoped = inferScope(arg, { ...context, minimalType: minimalArgType });
  //   tree = setField(["children", 0], fnScoped)(tree);
  //   tree = setField(["children", 1], argScoped)(tree);
  //   return setField(["data", "scope"], scope)(tree);
  // }

  // /* function */
  // if (matchString(tree, "_ -> _")[0]) {
  //   const scope = new Scope();
  //   const [arg, ret] = tree.children;
  //   // const typeVarIndex = scope.push(type());
  //   // const minimalArgType = context.minimalType.kind === "function" ? context.minimalType.types[0] : context.minimalType;
  //   // const minimalRetType = inferScope(ret, context).data.scope.getByName("type");
  //   const argScoped = inferScope(arg, { ...context, isBinding: true });
  //   const retScoped = inferScope(ret, context);
  //   scope.append(retScoped.data.scope);
  //   for (const name in argScoped.data.scope.names) {
  //     scope.removeByName(name);
  //   }
  //   tree = setField(["children", 0], argScoped)(tree);
  //   tree = setField(["children", 1], retScoped)(tree);
  //   return setField(["data", "scope"], scope)(tree);
  // }

  // /* variable name */
  // if (tree.name === "name") {
  //   const scopeType = context.scope.getByName(tree.value);
  //   const scope = new Scope();
  //   const typeVarIndex = scope.push(type());
  //   const name = tree.value;
  //   const typeVar = index(typeVarIndex);
  //   let _type = and(typeVar, context.minimalType);
  //   if (scopeType) _type = and(_type, scopeType);
  //   _type = simplifyType(_type);
  //   scope.add(name, _type);
  //   return setField(["data", "scope"], scope)(tree);
  // }

  return setField(["data", "scope"], new Scope())(tree);
};
