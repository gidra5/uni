import { NodeType, Tree, node } from "../ast";
import { assert, getPos } from "../utils";
import type { Position } from "../utils/position.js";

const name = (value: string, position?: Position) => node(NodeType.NAME, { data: { value }, position });
const numberLiteral = (value: number, position?: Position) => node(NodeType.NUMBER, { data: { value }, position });
const tupleLiteral = (position?: Position) => node(NodeType.TUPLE, { children: [], position });
const application = (callee: Tree, args: Tree[], position?: Position) =>
  node(NodeType.APPLICATION, { children: [callee, ...args], position });
const assign = (lhs: Tree, rhs: Tree, position?: Position) => node(NodeType.ASSIGN, { children: [lhs, rhs], position });
const declare = (lhs: Tree, rhs: Tree, position?: Position) =>
  node(NodeType.DECLARE, { children: [lhs, rhs], position });

const breakExpr = (value?: Tree, position?: Position) => {
  if (value) return application(name("break", position), [value], position);
  return name("break", position);
};

const desugarWhile = (ast: Tree): Tree => {
  const [condition, body] = ast.children;
  assert(condition, "while requires condition");
  const position = getPos(ast.id);
  const thenBranch = body ?? tupleLiteral(position);
  const elseBranch = breakExpr(undefined, position);

  const loopBody = node(NodeType.IF_ELSE, { position, children: [condition, thenBranch, elseBranch] });
  return node(NodeType.LOOP, { position, children: [loopBody] });
};

const desugarFor = (ast: Tree): Tree => {
  const [pattern, iterable, rawBody] = ast.children;
  assert(pattern && iterable, "for requires pattern and iterable");
  assert(pattern.type === NodeType.NAME, "for pattern must be a name");

  const position = getPos(ast.id);
  const iterRef = `_for_iter_${ast.id}`;
  const accRef = `_for_acc_${ast.id}`;
  const indexRef = `_for_idx_${ast.id}`;

  const iterInit = declare(name(iterRef, position), iterable, position);
  const accInit = declare(name(accRef, position), tupleLiteral(position), position);
  const indexInit = declare(name(indexRef, position), numberLiteral(0, position), position);

  const lengthCall = application(name("length", position), [name(iterRef, position)], position);
  const condition = node(NodeType.LESS, { position, children: [name(indexRef, position), lengthCall] });

  const bindPattern = assign(
    pattern,
    application(name("index", position), [name(iterRef, position), name(indexRef, position)], position),
    position
  );

  const body = rawBody ?? name("null", position);

  const appendCall = application(name("append", position), [name(accRef, position), body], position);
  const accUpdate = assign(name(accRef, position), appendCall, position);

  const indexUpdate = assign(
    name(indexRef, position),
    node(NodeType.ADD, { position, children: [name(indexRef, position), numberLiteral(1, position)] }),
    position
  );

  const loopThen = node(NodeType.SEQUENCE, { position, children: [bindPattern, accUpdate, indexUpdate] });
  const loopElse = breakExpr(name(accRef, position), position);
  const loopBody = node(NodeType.IF_ELSE, { position, children: [condition, loopThen, loopElse] });

  return node(NodeType.SEQUENCE, {
    position,
    children: [iterInit, accInit, indexInit, node(NodeType.LOOP, { position, children: [loopBody] })],
  });
};

// TODO: desugar does not change inferred types

export const desugar = (ast: Tree): Tree => {
  ast.children = ast.children.map(desugar);

  switch (ast.type) {
    case NodeType.PARENS:
      assert(ast.children.length === 1);
      if (ast.children[0].type === NodeType.IMPLICIT_PLACEHOLDER) return tupleLiteral(getPos(ast.id));
      return ast.children[0];
    case NodeType.WHILE:
      return desugarWhile(ast);
    case NodeType.FOR:
      return desugarFor(ast);
    default:
      return ast;
  }
};
