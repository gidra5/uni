import { parseTokensToASTs } from "./ast";
import {
  AbstractSyntaxTree,
  AbstractSyntaxTreeChildren,
  ParsingError,
  Scope,
  FlatSyntaxTree,
  ConsumeParsingResult,
} from "./types";
import { omit, pick } from "../utils";

const blockScope = (inner: (outer: Scope) => Scope): Scope => ({
  sequence: {
    leadingTokens: [";", "\n"],
    separators: [{ tokens: [";", "\n"], repeats: [0, Infinity], scope: inner }],
    precedence: [null, null],
  },
});

const bindingScope: Scope = {
  bind: { leadingTokens: [":="], separators: [], precedence: [Infinity, 1] },
  mutate: { leadingTokens: ["="], separators: [], precedence: [Infinity, 1] },
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
  arrow: {
    leadingTokens: ["->"],
    separators: [],
    precedence: [Infinity, Infinity],
  },
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
  tuple: {
    leadingTokens: [","],
    separators: [{ tokens: [","], repeats: [0, Infinity] }],
    precedence: [1, 2],
  },
  logical: { leadingTokens: ["and", "or"], separators: [], precedence: [1, 2] },
  equality: { leadingTokens: ["==", "is"], separators: [], precedence: [3, 4] },
  comparison: {
    leadingTokens: [">", ">=", "<", "<="],
    separators: [],
    precedence: [5, 6],
  },
  term: { leadingTokens: ["+", "-"], separators: [], precedence: [7, 8] },
  factor: { leadingTokens: ["*", "/"], separators: [], precedence: [9, 10] },
  exponent: { leadingTokens: ["^", "%"], separators: [], precedence: [11, 12] },
  unary: {
    leadingTokens: ["not", "-", "sqrt"],
    separators: [],
    precedence: [null, 13],
  },
  postfixNot: {
    leadingTokens: ["not"],
    separators: [],
    precedence: [14, null],
  },
};
const topLevelScope: Scope = {
  import: {
    leadingTokens: ["import", "use"],
    separators: [
      {
        tokens: ["as"],
        repeats: [1, 1],
        scope: () => pick(exprScope, ["block"]),
      },
      {
        tokens: ["with"],
        repeats: [0, 1],
        scope: () => pick(exprScope, ["block"]),
      },
    ],
    precedence: [null, 1],
  },
  external: {
    leadingTokens: ["external"],
    separators: [
      {
        tokens: [":"],
        repeats: [0, 1],
        scope: () => pick(exprScope, ["block"]),
      },
      {
        tokens: ["as"],
        repeats: [0, 1],
        scope: () => pick(exprScope, ["block"]),
      },
      {
        tokens: ["="],
        repeats: [0, 1],
        scope: () => pick(exprScope, ["block"]),
      },
    ],
    precedence: [null, 1],
  },
  export: {
    leadingTokens: ["export", "protected"],
    separators: [
      {
        tokens: ["="],
        repeats: [0, 1],
        scope: () => pick(exprScope, ["block"]),
      },
    ],
    precedence: [null, 1],
  },
};
const scope: Scope = {
  ...blockScope(() => omit(scope, ["sequence"])),
  ...topLevelScope,
  ...pick(bindingScope, ["bind"]),
};

const expandTree = (
  tree: FlatSyntaxTree
): ConsumeParsingResult<AbstractSyntaxTree> => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree = { item: { type: "newline", src: "\n" } };

  if (tree.lhs) {
    const [expanded, _errors] = expandTree(tree.lhs);
    result.lhs = expanded;
    errors.push(..._errors);
  }

  if (tree.item.type === "operator") {
    const children: AbstractSyntaxTreeChildren[] = [];

    for (const child of tree.item.children) {
      const [asts, errors] = parseTokensToASTs(child.children, 0, scope);
      const _children: AbstractSyntaxTree[] = [];
      for (const ast of asts) {
        const [expanded, _errors] = expandTree(ast);
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
    const [expanded, _errors] = expandTree(tree.rhs);
    result.rhs = expanded;
    errors.push(..._errors);
  }

  return [result, errors];
};

export const expandTrees = (
  ast: FlatSyntaxTree[]
): ConsumeParsingResult<AbstractSyntaxTree[]> => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree[] = [];

  for (const item of ast) {
    const [expanded, _errors] = expandTree(item);
    result.push(expanded);
    errors.push(..._errors);
  }

  return [result, errors];
};
