import { AbstractSyntaxTree } from "../parser/ast";
import { TypeScope } from "./types";

type InferTypeContext = {};

// infers names and minimal interface for them for a given tree
export const inferScope = <T>(
  tree: AbstractSyntaxTree<T>,
  context: InferTypeContext = {}
): AbstractSyntaxTree<T & { scope: TypeScope }> => {};
