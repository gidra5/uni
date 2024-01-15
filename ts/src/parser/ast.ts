import { Tree } from "../tree";

export type AbstractSyntaxTree = Tree & { value?: string };

export const placeholder = (): AbstractSyntaxTree => ({
  name: "placeholder",
  children: [],
});
export const name = (value: string): AbstractSyntaxTree => ({
  name: "name",
  value,
  children: [],
});
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
