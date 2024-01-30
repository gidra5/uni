import { AbstractSyntaxTree } from "../parser/ast";
import { Type } from "./types";

// check if value is assignable to variable
export const assignable = (valueType: Type, variableType: Type): boolean => {
  return false;
};

export const chechValue = (ast: AbstractSyntaxTree, type: Type): boolean => {
  return false;
};
