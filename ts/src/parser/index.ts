import { parseGroupsToASTs, parseStringToAST } from "./ast";
import { AbstractSyntaxTree, AbstractSyntaxTreeChildren, ParsingError, Scope, FlatSyntaxTree, Token } from "./types";

const blockScope: Scope = {
  sequence: { separators: [{ tokens: [";", "\n"], repeats: [1, Infinity] }], precedence: [1, null] },
};
const exprScope: Scope = {
  unary: { separators: [{ tokens: ["not", "-", "sqrt"], repeats: [1, 1] }], precedence: [null, 13] },
  postfixNot: { separators: [{ tokens: ["not"], repeats: [1, 1] }], precedence: [14, null] },
  logical: { separators: [{ tokens: ["and", "or"], repeats: [1, 1] }], precedence: [1, 2] },
  equality: { separators: [{ tokens: ["==", "is"], repeats: [1, 1] }], precedence: [3, 4] },
  comparison: { separators: [{ tokens: [">", ">=", "<", "<="], repeats: [1, 1] }], precedence: [5, 6] },
  term: { separators: [{ tokens: ["+", "-"], repeats: [1, 1] }], precedence: [7, 8] },
  factor: { separators: [{ tokens: ["*", "/"], repeats: [1, 1] }], precedence: [9, 10] },
  exponent: { separators: [{ tokens: ["^", "%"], repeats: [1, 1] }], precedence: [11, 12] },
  arrow: { separators: [{ tokens: ["->"], repeats: [1, 1] }], precedence: [Infinity, 13] },
  index: {
    separators: [
      { tokens: ["["], repeats: [1, 1] },
      { tokens: ["]"], repeats: [1, 1] },
    ],
    precedence: [Infinity, null],
  },
  generic: {
    separators: [
      { tokens: ["<"], repeats: [1, 1] },
      { tokens: [">"], repeats: [1, 1] },
    ],
    precedence: [null, null],
  },
  group: {
    separators: [
      { tokens: ["("], repeats: [1, 1] },
      { tokens: [")"], repeats: [1, 1] },
    ],
    precedence: [null, null],
  },
  if: {
    separators: [
      { tokens: ["if"], repeats: [1, 1] },
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, Infinity],
  },
  block: {
    separators: [
      { tokens: ["{"], repeats: [1, 1] },
      { tokens: ["}"], repeats: [1, 1] },
    ],
    precedence: [null, null],
  },
  tuple: { separators: [{ tokens: [","], repeats: [1, Infinity] }], precedence: [1, 2] },
};
const commentsScope: Scope = {
  comment: {
    separators: [
      { tokens: ["//"], repeats: [1, 1] },
      { tokens: ["\n"], repeats: [1, 1] },
    ],
    precedence: [null, null],
  },
  multilineComment: {
    separators: [
      { tokens: ["/*"], repeats: [1, 1] },
      { tokens: ["*/"], repeats: [1, 1] },
    ],
    precedence: [null, null],
  },
};
const topLevelScope: Scope = {
  import: {
    separators: [
      { tokens: ["import"], repeats: [1, 1] },
      { tokens: ["with"], repeats: [0, 1] },
      { tokens: ["as"], repeats: [1, 1] },
    ],
    precedence: [null, 1],
  },
  external: {
    separators: [
      { tokens: ["external"], repeats: [1, 1] },
      { tokens: [":"], repeats: [0, 1] },
      { tokens: ["="], repeats: [0, 1] },
    ],
    precedence: [null, 1],
  },
  export: {
    separators: [
      { tokens: ["export"], repeats: [1, 1] },
      { tokens: ["as", "="], repeats: [0, 1] },
    ],
    precedence: [null, 1],
  },
};
const scope: Scope = {
  ...topLevelScope,
  ...commentsScope,
  ...exprScope,
  ...blockScope,
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
      const [ast, errors] = parseGroupsToASTs(child.children, 0, scope);
      const _children: AbstractSyntaxTree[] = [];
      for (const _ast of ast) {
        const [expanded, _errors] = expand(_ast);
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

export const parse = (src: string): [AbstractSyntaxTree[], ParsingError[]] => {
  const [ast, errors] = parseStringToAST(src, 0, scope);
  const result: AbstractSyntaxTree[] = [];

  for (const item of ast) {
    const [expanded, _errors] = expand(item);
    result.push(expanded);
    errors.push(..._errors);
  }

  return [result, errors];
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
