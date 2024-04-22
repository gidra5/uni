import { AbstractSyntaxTree, group, operator } from "../parser/ast.js";
import { comparisonOps } from "../parser/constants.js";
import { traverse } from "../tree.js";

export const desugar = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  // expressions

  // any other dangling labels outside of tuple literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "label",
    (node) => {
      const [name, value] = node.children;
      return operator("set", group("unit"), name, value);
    }
  );

  // comparison sequence to and of comparisons
  traverse(
    ast,
    (node) => node.name === "operator" && comparisonOps.some((x) => x === node.value),
    (node) => {
      const comparisons: AbstractSyntaxTree[] = [];
      let prev = node.children[0];
      let prevOp = node.value;
      const traverse = (node) => {
        if (!(node.name === "operator" && comparisonOps.some((x) => x === node.value))) {
          comparisons.push(operator(prevOp, prev, node));
          return;
        }
        const [left, right] = node.children;
        comparisons.push(operator(prevOp, prev, left));
        prev = left;
        prevOp = node.value;
        traverse(right);
      };
      traverse(node.children[1]);
      if (comparisons.length === 1) return comparisons[0];
      return operator("and", ...comparisons);
    }
  );

  // functions

  // function argument list to curried function
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [params, body] = node.children;
      if (params.value !== ",") return node;
      const param = params.children[params.children.length - 1]!;
      const fn = operator("fn", param, body);
      return params.children.reduceRight((acc, param) => operator("fn", param, acc), fn);
    }
  );

  // macro argument list to curried macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      const [params, body] = node.children;
      if (params.value !== ",") return node;
      const param = params.children[params.children.length - 1];
      const fn = operator("macro", param, body);
      return params.children.reduceRight((acc, param) => operator("macro", param, acc), fn);
    }
  );

  return ast;
};
