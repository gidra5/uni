import { AbstractSyntaxTree, group, int, operator, placeholder, string } from "../parser/ast.js";
import { comparisonOps } from "../parser/constants.js";
import { templateString } from "../parser/string.js";
import { traverse } from "../tree.js";
import { inspect } from "../utils/index.js";

export const transform = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  // import

  // importAs to import
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "importAs",
    (node) => {
      const [path, name] = node.children;
      return templateString("_ := import _", [name, path]);
    }
  );

  // importAsWith to import
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "importAsWith",
    (node) => {
      const [path, name, _with] = node.children;
      return templateString("_ := import _ _", [name, path, _with]);
    }
  );

  // importWith to import
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "importWith",
    (node) => {
      const [path, _with] = node.children;
      return templateString("import _ _", [path, _with]);
    }
  );

  // atoms
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "atom",
    (node) => {
      node.name = "atom";
      node.value = node.children[0].value;
      node.children = [];
    }
  );

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
  // tuple literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === ",",
    (node) => {
      return node.children.reduce((acc, child) => {
        if (child.name === "placeholder") return acc;
        if (child.value === "label" && child.name === "operator") {
          const [name, value] = child.children;
          const nameNode = name.name === "name" ? string(name.value) : name;
          return operator("set", acc, nameNode, value);
        }
        if (child.value === "...") {
          const [value] = child.children;
          return operator("join", acc, value);
        }
        return operator("push", acc, child);
      }, group("unit"));
    }
  );

  // any other dangling labels outside of tuple literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "label",
    (node) => {
      const [name, value] = node.children;
      return operator("set", group("unit"), name, value);
    }
  );

  // unit
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "parens",
    (node) => {
      if (node.children.length > 1) return;
      if (node.children.length === 1 && node.children[0].name !== "placeholder") return;
      node.name = "unit";
      delete node.value;
      node.children = [];
    }
  );

  // pipe operator to function application
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "|>",
    (node) => {
      const [arg, fn] = node.children;
      return operator("application", fn, arg);
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

  // comparisons to single direction
  traverse(
    ast,
    (node) => node.name === "operator" && comparisonOps.some((x) => x === node.value),
    (node) => {
      const [left, right] = node.children;
      if (node.value === ">") return operator("<", right, left);
      if (node.value === ">=") return templateString("!(_ < _)", [left, right]);
      if (node.value === "<=") return templateString("!(_ < _)", [right, left]);
      return node;
    }
  );

  // not equal to equal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "!=",
    (node) => {
      const [left, right] = node.children;
      return templateString("!(_ == _)", [left, right]);
    }
  );

  // not deep equal to deep equal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "!==",
    (node) => {
      const [left, right] = node.children;
      return templateString("!(_ === _)", [left, right]);
    }
  );

  // // ; to fn
  // ast = traverse(
  //   ast,
  //   (node) => node.name === "operator" && node.value === ";",
  //   (node) => {
  //     return node.children.reduce(
  //       (acc, child) =>
  //         inspect(
  //           acc.name === "placeholder"
  //             ? child
  //             : child.name === "placeholder"
  //             ? acc
  //             : templateString("(fn _ -> _) _", [placeholder(), child, acc])
  //         ),
  //       placeholder()
  //     );
  //   }
  // );

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

  // statements

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
      return templateString("loop ({ cond := _; if !cond: break() }; _)", [condition, body]);
    }
  );

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

  // -> operator to function literal
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "->",
    (node) => {
      node.value = "fn";
    }
  );

  // fnBlock to fn
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnBlock",
    (node) => {
      node.value = "fn";
    }
  );

  // fnArrowBlock to fn
  ast = traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnArrowBlock",
    (node) => {
      node.value = "fn";
      node.children = [node.children[0], node.children[2]];
    }
  );

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

  // macroBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroBlock",
    (node) => {
      node.value = "macro";
    }
  );

  // macroArrowBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroArrowBlock",
    (node) => {
      node.value = "macro";
      node.children = [node.children[0], node.children[2]];
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

  // literals

  // channels
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "channel",
    (node) => {
      node.name = "channel";
      delete node.value;
      node.children = [];
    }
  );

  // symbols
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "symbol",
    (node) => {
      node.name = "symbol";
      delete node.value;
      node.children = [];
    }
  );

  // atom
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "atom",
    (node) => {
      node.name = "atom";
      node.value = node.children[0].value;
      node.children = [];
    }
  );

  // nameless binding and shadowing

  // nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "#" && node.children[0].name === "int",
    (node) => {
      node.name = "name";
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
      node.name = "name";
      node.value = { level: value.level + 1, name: value.name };
      node.children = [];
    },
    true
  );

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
