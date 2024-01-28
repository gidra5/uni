import { Tree } from "../tree";
import { matchString } from "./string";
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
  token.type === "number" ? number(token.value) : token.type === "string" ? string(token.value) : name(token.src);
export const group = (value?: string, ...children: AbstractSyntaxTree[]): AbstractSyntaxTree => ({
  name: "group",
  value,
  children,
});
export const infix = (
  ...children: [group: AbstractSyntaxTree, lhs: AbstractSyntaxTree, rhs: AbstractSyntaxTree]
): AbstractSyntaxTree => ({
  name: "infix",
  children,
});
export const postfix = (...children: [group: AbstractSyntaxTree, lhs: AbstractSyntaxTree]): AbstractSyntaxTree => ({
  name: "postfix",
  children,
});
export const prefix = (...children: [group: AbstractSyntaxTree, rhs: AbstractSyntaxTree]): AbstractSyntaxTree => ({
  name: "prefix",
  children,
});

export const tuple = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  while (true) {
    const [matched, { left, right }] = matchString(node, "left, right");
    if (!matched) break;
    if (right.name !== "placeholder") children.unshift(right);
    node = left;
  }

  if (children.length === 0) return node;
  return { name: "tuple", children };
};

export const sequence = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  while (true) {
    const [matched, { left, right }] = matchString(node, "left; right");
    if (!matched) break;
    if (right.name !== "placeholder") children.unshift(right);
    node = left;
  }

  if (children.length === 0) return node;
  return { name: "sequence", children };
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
  return { name: "record", children };
};

export const field = (...children: [name: AbstractSyntaxTree, value: AbstractSyntaxTree]): AbstractSyntaxTree => ({
  name: "field",
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
  return { name: "map", children };
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
  return { name: "set", children };
};

export const pattern = (node: AbstractSyntaxTree): AbstractSyntaxTree => {
  const children: AbstractSyntaxTree[] = [];

  return { name: "pattern", children };
};
