import { Tree } from "../tree";
import { Token } from "./types";

export type AbstractSyntaxTree = Tree & { value?: any };

export const placeholder = (): AbstractSyntaxTree => ({
  name: "placeholder",
  children: [],
});
export const name = (value: string): AbstractSyntaxTree => ({
  name: "name",
  value,
  children: [],
});
export const number = (value: number): AbstractSyntaxTree => ({
  name: "number",
  value,
  children: [],
});
export const string = (value: string): AbstractSyntaxTree => ({
  name: "string",
  value,
  children: [],
});
export const token = (token: Token): AbstractSyntaxTree =>
  token.type === "number"
    ? number(token.value)
    : token.type === "string"
    ? string(token.value)
    : name(token.src);
export const group = (
  value?: string,
  ...children: AbstractSyntaxTree[]
): AbstractSyntaxTree => ({
  name: "group",
  value,
  children,
});
export const infix = (
  ...children: [
    group: AbstractSyntaxTree,
    lhs: AbstractSyntaxTree,
    rhs: AbstractSyntaxTree
  ]
): AbstractSyntaxTree => ({
  name: "infix",
  children,
});
export const postfix = (
  ...children: [group: AbstractSyntaxTree, lhs: AbstractSyntaxTree]
): AbstractSyntaxTree => ({
  name: "postfix",
  children,
});
export const prefix = (
  ...children: [group: AbstractSyntaxTree, rhs: AbstractSyntaxTree]
): AbstractSyntaxTree => ({
  name: "prefix",
  children,
});
