import { parseStringToAST, parseTokensToASTs } from "./ast";
import { AbstractSyntaxTree, AbstractSyntaxTreeChildren, ParsingError, Scope, FlatSyntaxTree, Token } from "./types";

const blockScope: Scope = {
  sequence: {
    leadingTokens: [";", "\n"],
    separators: [{ tokens: [";", "\n"], repeats: [0, Infinity] }],
    precedence: [1, null],
  },
  define: { leadingTokens: ["="], separators: [], precedence: [Infinity, 1] },
};

const exprScope: Scope = {
  array: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  index: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [Infinity, null],
  },
  arrow: { leadingTokens: ["->"], separators: [], precedence: [Infinity, Infinity] },
  generic: {
    leadingTokens: ["<"],
    separators: [{ tokens: [">"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  group: {
    leadingTokens: ["("],
    separators: [{ tokens: [")"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  block: {
    leadingTokens: ["{"],
    separators: [{ tokens: ["}"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  if: {
    leadingTokens: ["if"],
    separators: [
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, Infinity],
  },
  tuple: { leadingTokens: [","], separators: [{ tokens: [","], repeats: [0, Infinity] }], precedence: [1, 2] },
  logical: { leadingTokens: ["and", "or"], separators: [], precedence: [1, 2] },
  equality: { leadingTokens: ["==", "is"], separators: [], precedence: [3, 4] },
  comparison: { leadingTokens: [">", ">=", "<", "<="], separators: [], precedence: [5, 6] },
  term: { leadingTokens: ["+", "-"], separators: [], precedence: [7, 8] },
  factor: { leadingTokens: ["*", "/"], separators: [], precedence: [9, 10] },
  exponent: { leadingTokens: ["^", "%"], separators: [], precedence: [11, 12] },
  unary: { leadingTokens: ["not", "-", "sqrt"], separators: [], precedence: [null, 13] },
  postfixNot: { leadingTokens: ["not"], separators: [], precedence: [14, null] },
};
const commentsScope: Scope = {
  comment: {
    leadingTokens: ["//"],
    separators: [{ tokens: ["\n"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  multilineComment: {
    leadingTokens: ["/*"],
    separators: [{ tokens: ["*/"], repeats: [1, 1] }],
    precedence: [null, null],
  },
};
const topLevelScope: Scope = {
  import: {
    leadingTokens: ["import"],
    separators: [
      { tokens: ["with"], repeats: [0, 1] },
      { tokens: ["as"], repeats: [1, 1] },
    ],
    precedence: [null, 1],
  },
  external: {
    leadingTokens: ["external"],
    separators: [
      { tokens: [":"], repeats: [0, 1] },
      { tokens: ["="], repeats: [0, 1] },
    ],
    precedence: [null, 1],
  },
  export: {
    leadingTokens: ["export"],
    separators: [{ tokens: ["as", "="], repeats: [0, 1] }],
    precedence: [null, 1],
  },
};
const scope: Scope = {
  ...commentsScope,
  ...blockScope,
  ...topLevelScope,
};

const expand = (tree: FlatSyntaxTree): [expanded: AbstractSyntaxTree, errors: ParsingError[]] => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree = { item: { type: "whitespace", src: " " } };

  if (tree.lhs) {
    const [expanded, _errors] = expand(tree.lhs);
    result.lhs = expanded;
    errors.push(..._errors);
  }

  if (tree.item.type === "operator") {
    const children: AbstractSyntaxTreeChildren[] = [];

    for (const child of tree.item.children) {
      const [asts, errors] = parseTokensToASTs(child.children, 0, scope);
      const _children: AbstractSyntaxTree[] = [];
      for (const ast of asts) {
        const [expanded, _errors] = expand(ast);
        _children.push(expanded);
        errors.push(..._errors);
      }
      children.push({ ...child, children: _children });
    }

    result.item = { ...tree.item, children };
  } else {
    result.item = tree.item;
  }

  if (tree.rhs) {
    const [expanded, _errors] = expand(tree.rhs);
    result.rhs = expanded;
    errors.push(..._errors);
  }

  return [result, errors];
};

type Module = Record<string, { type: "module"; module: Module } | { type: "item" }>;
type Expression = unknown;
type ModuleSyntaxTreeItem =
  | { type: "import"; from: string; with: Record<string, Expression>; alias: string }
  | { type: "export"; alias: string };
type ModuleSyntaxTree = ModuleSyntaxTreeItem[];
export const parse = (src: string) => {
  const [ast, errors] = parseStringToAST(src, 0, scope);
  const moduleSyntaxTree = parseModule(ast);
  const module: Module = {};
  const result: AbstractSyntaxTree[] = [];

  for (const item of ast) {
    const [expanded, _errors] = expand(item);
    result.push(expanded);
    errors.push(..._errors);
  }

  return [result, errors];
};

const parseModule = (ast: FlatSyntaxTree[]) => {
  const;
};

export const stringifyToken = (item: Token): string => {
  if (item.type === "newline" || item.type === "whitespace") return item.type;
  return item.src;
};

export const stringifyASTItem = (item: AbstractSyntaxTree["item"]): string => {
  if (item.type === "operator" && item.children.length > 0)
    return `${item.id} ${item.children
      .map((child) => `(${child.children.map(stringifyAST).join(" ")}):${child.separatorIndex}`)
      .join(" ")}`;
  if (item.type === "operator") return `${item.token.src}`;
  return stringifyToken(item);
};

export const stringifyAST = (ast: AbstractSyntaxTree): string => {
  let result = stringifyASTItem(ast.item);
  if (ast.lhs) result = `${result} (${stringifyAST(ast.lhs)})`;
  if (ast.rhs) result = `${result} (${stringifyAST(ast.rhs)})`;
  return result;
};

export const stringifyASTList = (list: AbstractSyntaxTree[]): string => list.map(stringifyAST).join("; ");
