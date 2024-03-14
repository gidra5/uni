import { AbstractSyntaxTree, group, operator, placeholder } from "../parser/ast";
import { comparisonOps } from "../parser/constants";
import { templateString } from "../parser/string";
import { traverse } from "../tree";

export const transform = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  // functions

  // -> operator to function literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "->",
    (node) => {
      node.value = "fn";
    }
  );

  // fnBlock to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnBlock",
    (node) => {
      node.value = "fn";
    }
  );

  // fn to typed fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      node.children = [node.children[0], placeholder(), node.children[1]];
    }
  );

  // fnArrowBlock to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnArrowBlock",
    (node) => {
      node.value = "fn";
    }
  );

  // function argument list to curried function
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [params, returnType, body] = node.children;
      if (params.value !== ",") return node;
      const param = params.children.pop()!;
      const fn = operator("fn", param, returnType, body);
      return params.children.reduceRight((acc, param) => operator("fn", param, placeholder(), acc), fn);
    }
  );

  // fn arg to nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [param, returnType, body] = node.children;
      if (param.name === "placeholder") return operator("fn", returnType, body);
      return operator("fn", returnType, templateString("{ _ := #0; _ }", [param, body]));
    }
  );

  // macroBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroBlock",
    (node) => {
      node.value = "macro";
    }
  );

  // macro to typed macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      node.children = [node.children[0], placeholder(), node.children[1]];
    }
  );

  // macroArrowBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroArrowBlock",
    (node) => {
      node.value = "macro";
    }
  );

  // macro arg to nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      const [param, returnType, body] = node.children;
      if (param.name === "placeholder") return operator("macro", returnType, body);
      return operator("macro", returnType, templateString("{ _ := #0; _ }", [param, body]));
    }
  );

  // statements

  // if and ifBlock to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && (node.value === "if" || node.value === "ifBlock"),
    (node) => {
      const condition = node.children[0];
      const ifTrue = node.children[1];

      return operator("ifElse", condition, ifTrue, placeholder());
    },
    true
  );

  // ifBlockElse to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "ifBlockElse",
    (node) => {
      node.value = "ifElse";
    }
  );

  // ifElse to match
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "ifElse",
    (node) => {
      const [condition, ifTrue, ifFalse] = node.children;
      return templateString("match _ { true -> _, false -> _ }", [condition, ifTrue, ifFalse]);
    }
  );

  // forBlock to for
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "forBlock",
    (node) => {
      node.value = "for";
    }
  );

  // whileBlock to while
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "whileBlock",
    (node) => {
      node.value = "while";
    }
  );

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
      return templateString("loop ({ cond := _; if !cond: break }; _)", [condition, body]);
    }
  );

  // loop to block
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "loop",
    (node) => {
      const [body] = node.children;
      return templateString("{ _; continue }", [body]);
    }
  );

  // expressions

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

  // clear placeholders from ";" and "," operator
  traverse(
    ast,
    (node) => node.name === "operator" && (node.value === ";" || node.value === ","),
    (node) => {
      return operator(node.value, ...node.children.filter((child) => child.name !== "placeholder"));
    }
  );

  // postfix increment
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "postfixIncrement",
    (node) => {
      const [expr] = node.children;
      return templateString("{ value := _; _ = value + 1; value }", [expr, expr]);
    }
  );

  // postfix decrement
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "postfixDecrement",
    (node) => {
      const [expr] = node.children;
      return templateString("{ value := _; _ = value - 1; value }", [expr, expr]);
    }
  );

  // prefix increment
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "prefixIncrement",
    (node) => {
      const [expr] = node.children;
      return templateString("_ = _ + 1", [expr, expr]);
    }
  );

  // prefix decrement
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "prefixDecrement",
    (node) => {
      const [expr] = node.children;
      return templateString("_ = _ - 1", [expr, expr]);
    }
  );

  // nameless binding and shadowing

  // nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "#" && node.children[0].name === "int",
    (node) => {
      node.value = node.children[0].value;
      node.children = [];
    }
  );

  // shadowing
  traverse(
    ast,
    (node) =>
      node.name === "operator" &&
      node.value === "#" &&
      (node.children[0].name === "name" || node.children[0].value === "#"),
    (node) => {
      let value = node.children[0].value;
      if (typeof value === "string") value = { level: 0, name: value };
      node.value = { level: value.level + 1, name: value.name };
      node.children = [];
    },
    true
  );

  return ast;
};
