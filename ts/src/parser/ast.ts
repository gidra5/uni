import { Token } from "./types.js";

export type AbstractSyntaxTree<T = any> = {
  name: string;
  value?: any;
  data: T;
  children: AbstractSyntaxTree<T>[];
};

export const error = (): AbstractSyntaxTree => ({
  name: "placeholder",
  data: {},
  children: [],
});

export const placeholder = (): AbstractSyntaxTree => ({
  name: "placeholder",
  data: {},
  children: [],
});

export const name = (value: string): AbstractSyntaxTree => ({
  name: "name",
  value,
  data: {},
  children: [],
});

export const bool = (value: boolean): AbstractSyntaxTree => ({
  name: "bool",
  value,
  data: {},
  children: [],
});

export const int = (value: number): AbstractSyntaxTree => ({
  name: "int",
  value,
  data: {},
  children: [],
});

export const float = (value: number): AbstractSyntaxTree => ({
  name: "float",
  value,
  data: {},
  children: [],
});

export const string = (value: string): AbstractSyntaxTree => ({
  name: "string",
  value,
  data: {},
  children: [],
});

export const token = (token: Token): AbstractSyntaxTree =>
  token.type === "number"
    ? token.src.includes(".")
      ? float(token.value)
      : int(token.value)
    : token.type === "string"
    ? string(token.value)
    : /^_+$/.test(token.src)
    ? placeholder()
    : token.src === "true" || token.src === "false"
    ? bool(token.src === "true")
    : name(token.src);

export const group = (value?: string | symbol, ...children: AbstractSyntaxTree[]): AbstractSyntaxTree => ({
  name: "operator",
  value,
  data: {},
  children,
});

export const operator = (value: string | symbol, ...children: AbstractSyntaxTree[]): AbstractSyntaxTree => ({
  name: "operator",
  value,
  data: {},
  children,
});

export const infix = (
  group: AbstractSyntaxTree,
  lhs: AbstractSyntaxTree,
  rhs: AbstractSyntaxTree
): AbstractSyntaxTree => {
  const { value, children } = group;
  return operator(value, lhs, ...children, rhs);
};

export const postfix = (group: AbstractSyntaxTree, lhs: AbstractSyntaxTree): AbstractSyntaxTree => {
  const { value, children } = group;
  return operator(value, lhs, ...children);
};

export const prefix = (group: AbstractSyntaxTree, rhs: AbstractSyntaxTree): AbstractSyntaxTree => {
  const { value, children } = group;
  return operator(value, ...children, rhs);
};

export const program = (...children: AbstractSyntaxTree[]): AbstractSyntaxTree =>
  children.length > 1 ? operator(";", ...children) : children[0];
