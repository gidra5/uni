import { AbstractSyntaxTree, group, name, operator, placeholder } from "../parser/ast.js";
import { templateString } from "../parser/string.js";
import { traverse } from "../tree.js";

export const semanticReduction = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  
  // record assignment to setter
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === ":=",
    (node) => {
      const [record, value] = node.children;
      if (record.name !== "operator" || record.value !== "~") return;
      record.data.reference = true;
      return templateString("_ := &_", [record, value]);
    }
  );
  
    // record assignment to setter
    traverse(
      ast,
      (node) => node.name === "operator" && node.value === ":=",
      (node) => {
        const [record, value] = node.children;
        if (record.name !== "operator" || record.value !== "~") return;
        if (!record.data.reference) return;
        const [_symbol] = record;
        return templateString("current_scope[_] = _", [_symbol, value]);
      }
    );
  
  // symbol assignment to deref assignment 
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "=",
    (node) => {
      const [record, value] = node.children;
      if (record.name !== "operator" || record.value !== "~") return;
      // if (record.name === 'name') return;
      const [_symbol] = record.children;
      return templateString("*current_scope[_] = _", [_symbol, value]);
    }
  );
  
  // symbol value to deref
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "~",
    (node) => {
      const [value] = node.children;
      return templateString("*current_scope[_]", [value]);
    }
  );
  
  // reference assignment to setter
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "=",
    (node) => {
      const [record, value] = node.children;
      if (record.name !== "operator" || record.value !== "deref") return;
      // if (record.name === 'name') return;
      const [ref] = record.children;
      return templateString("_[setter] _", [ref, value]);
    }
  );
  
  // deref to getter
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "deref",
    (node) => {
      const [value] = node.children;
      return templateString("_[getter] ()", [value]);
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

  // statements

  // for to while
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "for",
    (node) => {
      const [pattern, expr, body] = node.children;
      const iteratorNameNode = name(Symbol("iterator"));
      const template = `{
        iterator := expr
        while iterator.has_next {
          pattern, rest := iterator.next
          iterator = rest
          body
        }
      }`;
      return templateString(template, { iterator: iteratorNameNode, expr, pattern, body });
    }
  );

  // while to loop
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "while",
    (node) => {
      const [condition, body] = node.children;
      return templateString("loop (if !_: break() else _)", [condition, body]);
    }
  );

  // if to ifElse
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
      return templateString("label::((_ and label { _ }) or label { _ })", [condition, ifTrue, ifFalse]);
    }
  );

  // loop to block
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "loop",
    (node) => {
      const [body] = node.children;
      return templateString("{ { _ }; continue () }", [body]);
    }
  );

  // block to fn
  // ast = traverse(
  //   ast,
  //   (node) => node.name === "operator" && node.value === "braces",
  //   (node) => {
  //     const [expr] = node.children;
  //     return templateString(
  //       "(fn f -> (fn x -> x x) fn self -> f (self self)) (fn self -> fn _ -> label::(continue := fn _ -> label (self ()); break := label; _)) ()",
  //       [placeholder(), placeholder(), expr]
  //     );
  //   }
  // );

  // functions

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

  return ast;
};
