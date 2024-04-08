import { AbstractSyntaxTree, group, int, operator, placeholder, string } from "../parser/ast.js";
import { comparisonOps } from "../parser/constants.js";
import { templateString } from "../parser/string.js";
import { traverse } from "../tree.js";
import { inspect } from "../utils/index.js";

export const transform = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  // record assignment to setter
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "=",
    (node) => {
      const [record, value] = node.children;
      if (record.name !== "operator" || record.value !== ".") return;
      // if (record.name === 'name') return;
      const [recordValue, field] = record.children;
      return templateString("_[setter] _ _", [recordValue, field, value]);
    }
  );

  // name declaration to symbol
  traverse(
    ast,
    (node) =>
      node.name === "operator" && (node.value === ":=" || node.value === "=") && node.children[0].name === "name",
    (node) => {
      node.children[0].name = "atom";
    }
  );

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

  // statements

  // for to while
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "for",
    (node) => {
      const [pattern, expr, body] = node.children;
      const template = "{ iterator := _; while iterator.has_next { _, rest := iterator.next; iterator = rest; _ } }";
      return templateString(template, [expr, pattern, body]);
    }
  );

  // while to loop
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "while",
    (node) => {
      const [condition, body] = node.children;
      return templateString("loop ({ cond := _; if !cond: break() }; _)", [condition, body]);
    }
  );

  // if and ifBlock to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "if",
    (node) => {
      const condition = node.children[0];
      const ifTrue = node.children[1];

      return operator("ifElse", condition, ifTrue, placeholder());
    },
    true
  );

  // match to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "match",
    (node) => {
      const [value, { children: branches }] = node.children;
      if (branches.length === 0) return group("braces");
      const branchTemplate = (branch, elseBranch) =>
        templateString("if _ is _: label _ else _", [value, branch.children[0], branch.children[1], elseBranch]);
      return templateString("label::_", [
        branches.reduceRight((acc, branch) => branchTemplate(branch, acc), placeholder()),
      ]);
    }
  );

  // ifElse to and-or
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "ifElse",
    (node) => {
      const [condition, ifTrue, ifFalse] = node.children;
      return templateString("label::((_ and label _) or label _)", [condition, ifTrue, ifFalse]);
    }
  );

  // loop to block
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "loop",
    (node) => {
      const [body] = node.children;
      return templateString("{ _; continue() }", [body]);
    }
  );

  // block to fn
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "braces",
    (node) => {
      const [expr] = node.children;
      return templateString(
        "(fn f -> (fn x -> x x) fn self -> f (self self)) (fn self -> fn _ -> label::(continue := fn _ -> label (self ()); break := label; _)) ()",
        [placeholder(), placeholder(), expr]
      );
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

  // function arg to nameless binding
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [param, body] = node.children;
      // console.log("function arg to nameless binding", node, param, body);

      if (param.name === "placeholder") return operator("fn", body);
      return operator("fn", operator("application", operator("fn", body), templateString("_ := #0", [param])));
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

  // macro arg to nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      const [param, body] = node.children;
      if (param.name === "placeholder") return operator("macro", body);
      return operator("macro", operator("application", operator("macro", body), templateString("_ := #0", [param])));
    }
  );

  // nameless binding and shadowing

  // eliminate parentheses
  traverse(
    ast,
    (node) => node.name === "operator" && (node.value === "parens" || node.value === "brackets"),
    (node) => {
      return node.children[0];
    }
  );

  return ast;
};
