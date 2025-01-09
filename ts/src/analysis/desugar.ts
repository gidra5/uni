import { node, NodeType, Tree } from "../ast";
import { assert } from "../utils";

// TODO: desugar does not change inferred types

export const desugar = (ast: Tree): Tree => {
  ast.children = ast.children.map(desugar);

  switch (ast.type) {
    case NodeType.PARENS:
      assert(ast.children.length === 1);
      if (ast.children[0].type === NodeType.IMPLICIT_PLACEHOLDER) return node(NodeType.UNIT);
      return ast.children[0];
    default:
      return ast;
  }
};
