import { assert } from "../utils/index.js";
import { matchString } from "./string.js";
import { Token } from "./types.js";

export type AbstractSyntaxTree<T = any> = {
  name: string;
  value?: any;
  data: T;
  children: AbstractSyntaxTree<T>[];
};

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
    : name(token.src);

export const group = (value?: string, ...children: AbstractSyntaxTree[]): AbstractSyntaxTree => ({
  name: "group",
  value,
  data: {},
  children,
});

export const operator = (value: string, ...children: AbstractSyntaxTree[]): AbstractSyntaxTree => ({
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
  assert(group.name === "group", 'infix: group.name !== "group"');
  const { value, children } = group;
  return operator(value, lhs, ...children, rhs);
};

export const postfix = (group: AbstractSyntaxTree, lhs: AbstractSyntaxTree): AbstractSyntaxTree => {
  assert(group.name === "group", 'postfix: group.name !== "group"');
  const { value, children } = group;
  return operator(value, lhs, ...children);
};

export const prefix = (group: AbstractSyntaxTree, rhs: AbstractSyntaxTree): AbstractSyntaxTree => {
  assert(group.name === "group", 'prefix: group.name !== "group"');
  const { value, children } = group;
  return operator(value, ...children, rhs);
};

export const record = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  [, { node }] = matchString(node, "record { fields }");

  while (true) {
    {
      const [matched, match] = matchString(node, "rest;field");
      if (matched) {
        const { field, rest } = match;
        if (field.name === "placeholder") {
          node = rest;
          continue;
        }
      }
    }
    {
      const [matched, match] = matchString(node, "rest; name: value");
      if (matched) {
        const { name, value, rest } = match;
        children.unshift(field(name, value));
        node = rest;
        continue;
      }
    }

    const [matched, match] = matchString(node, "name: value");
    if (matched) {
      const { name, value } = match;
      children.unshift(field(name, value));
    }

    break;
  }

  if (children.length === 0) return node;
  return { name: "record", data: {}, children };
};

export const field = (...children: [name: AbstractSyntaxTree, value: AbstractSyntaxTree]): AbstractSyntaxTree => ({
  name: "field",
  data: {},
  children,
});

export const map = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  [, { node }] = matchString(node, "map { fields }");

  while (true) {
    {
      const [matched, match] = matchString(node, "rest;field");
      if (matched) {
        const { field, rest } = match;
        if (field.name === "placeholder") {
          node = rest;
          continue;
        }
      }
    }
    {
      const [matched, match] = matchString(node, "rest; key: value");
      if (matched) {
        const { key, value, rest } = match;
        children.unshift(field(key, value));
        node = rest;
        continue;
      }
    }

    const [matched, match] = matchString(node, "key: value");
    if (matched) {
      const { key, value } = match;
      children.unshift(field(key, value));
    }

    break;
  }

  if (children.length === 0) return node;
  return { name: "map", data: {}, children };
};

export const set = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  [, { node }] = matchString(node, "set { values }");

  while (true) {
    {
      const [matched, match] = matchString(node, "rest; value");
      if (matched) {
        const { value, rest } = match;
        if (value.name !== "placeholder") children.unshift(value);
        node = rest;
        continue;
      }
    }
    children.unshift(node);
    break;
  }

  if (children.length === 0) return node;
  return { name: "set", data: {}, children };
};

export const pattern = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  return { name: "pattern", data: {}, children };
};

export const program = (...children: AbstractSyntaxTree[]): AbstractSyntaxTree => operator(";", ...children);
