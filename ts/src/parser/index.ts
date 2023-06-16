import { parseOperatorsToAST, parseStringToAST } from "./ast";
import { FullSyntaxTree, FullSyntaxTreeItemChildren, ParsingError, Scope, SyntaxTree } from "./types";

const scope: Scope = {
  // import: {
  //   separators: [
  //     { tokens: ["import"], repeats: [1, 1] },
  //     { tokens: ["as"], repeats: [1, 1] },
  //   ],
  //   precedence: [null, 1],
  // },
  add: { separators: [{ tokens: ["+"], repeats: [1, 1] }], precedence: [1, 2] },
  sub: { separators: [{ tokens: ["-"], repeats: [1, 1] }], precedence: [1, 2] },
  mul: { separators: [{ tokens: ["*"], repeats: [1, 1] }], precedence: [3, 4] },
  div: { separators: [{ tokens: ["/"], repeats: [1, 1] }], precedence: [3, 4] },
  pow: { separators: [{ tokens: ["^"], repeats: [1, 1] }], precedence: [5, 6] },
  mod: { separators: [{ tokens: ["%"], repeats: [1, 1] }], precedence: [7, 8] },
};

const expand = (tree: SyntaxTree): [expanded: FullSyntaxTree, errors: ParsingError[]] => {
  const errors: ParsingError[] = [];
  const result: FullSyntaxTree = { item: { type: "whitespace", src: " " } };

  if (tree.lhs) {
    const [expanded, _errors] = expand(tree.lhs);
    result.lhs = expanded;
    errors.push(..._errors);
  }

  if (tree.item.type === "operator") {
    const children: FullSyntaxTreeItemChildren[] = [];

    for (const child of tree.item.children) {
      const [_, ast, errors] = parseOperatorsToAST(child.children, 0, 0, scope);
      const [expanded, _errors] = expand(ast);
      children.push({ ...child, children: expanded });
      errors.push(..._errors);
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

  return [{ item: { type: "whitespace", src: " " } }, []];
};

export const parse = (src: string) => {
  const [_, ast, errors] = parseStringToAST(src, 0, scope);
  const result: FullSyntaxTree[] = [];

  for (const item of ast) {
    const [expanded, _errors] = expand(item);
    result.push(expanded);
    errors.push(..._errors);
  }

  return [result, errors];
};
