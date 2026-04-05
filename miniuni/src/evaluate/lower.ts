import {
  application,
  block,
  ifElse,
  loop,
  name as nameAST,
  NodeType,
  node,
  number,
  placeholder,
  sequence,
  tuple as tupleAST,
  type Tree,
} from '../ast.js';
import { getPosition } from '../parser.js';
import type { Position } from '../position.js';
import { assert } from '../utils.js';

const declare = (pattern: Tree, expr: Tree, position: Position) =>
  node(NodeType.DECLARE, {
    children: [pattern, expr],
    position,
  });

const declareMut = (name: Tree, expr: Tree, position: Position) =>
  declare(
    node(NodeType.MUTABLE, { children: [name], position }),
    expr,
    position
  );

const assign = (pattern: Tree, expr: Tree, position = getPosition(pattern)) =>
  node(NodeType.ASSIGN, { children: [pattern, expr], position });

const whileAST = (condition: Tree, body: Tree, position = getPosition(body)) =>
  node(NodeType.WHILE, { children: [condition, body], position });

const notEq = (lhs: Tree, rhs: Tree, position = getPosition(lhs)) =>
  node(NodeType.NOT_EQUAL, { children: [lhs, rhs], position });

const index = (lhs: Tree, rhs: Tree, position = getPosition(lhs)) =>
  node(NodeType.INDEX, { children: [lhs, rhs], position });

const atomAST = (name: string, position: Position) =>
  node(NodeType.ATOM, { data: { name }, position });

const spread = (pattern: Tree, position = getPosition(pattern)) =>
  node(NodeType.SPREAD, { children: [pattern], position });

const ifAST = (condition: Tree, body: Tree, position = getPosition(body)) =>
  node(NodeType.IF, { children: [condition, body], position });

// TODO: should walk the tree and lower the whole tree at once
export const lower = (ast: Tree): Tree => {
  const lowerStep = (ast: Tree): Tree => {
    switch (ast.type) {
      case NodeType.PARALLEL: {
        return tupleAST(
          ast.children.map((child) =>
            node(NodeType.ASYNC, {
              children: [child],
              position: getPosition(child),
            })
          )
        );
      }

      case NodeType.AND: {
        const [head, ...rest] = ast.children;
        if (!head) return ast;
        if (rest.length === 0) return head;

        const restAst =
          rest.length > 1 ? node(NodeType.AND, { children: rest }) : rest[0]!;
        return ifElse(
          head,
          restAst,
          nameAST('false', getPosition(head)),
          getPosition(ast)
        );
      }

      case NodeType.OR: {
        const [head, ...rest] = ast.children;
        if (!head) return ast;
        if (rest.length === 0) return head;

        const restAst =
          rest.length > 1 ? node(NodeType.OR, { children: rest }) : rest[0]!;
        return ifElse(
          head,
          nameAST('true', getPosition(head)),
          restAst,
          getPosition(ast)
        );
      }

      case NodeType.IF: {
        const [condition, branch] = ast.children;
        if (!condition || !branch) return ast;
        const falseBranch = placeholder(getPosition(branch));
        return ifElse(condition, branch, falseBranch, getPosition(ast));
      }

      case NodeType.FOR: {
        const [pattern, expr, body] = ast.children;
        if (!pattern || !expr || !body) return ast;

        const pos = getPosition(body);
        const iterName = nameAST('iter', pos);
        const mappedName = nameAST('mapped', pos);
        const restName = nameAST('rest', pos);
        const valueName = nameAST('value', pos);

        const declareIter = declareMut(iterName, expr, pos);
        const declareMapped = declareMut(mappedName, tupleAST([]), pos);
        const loopBody = sequence([
          declare(tupleAST([pattern, spread(restName)]), iterName, pos),
          ifAST(
            node(NodeType.IS, {
              children: [body, valueName],
              position: getPosition(body),
            }),
            assign(
              mappedName,
              tupleAST([spread(mappedName), valueName]),
              getPosition(mappedName)
            ),
            getPosition(body)
          ),
          assign(iterName, restName, getPosition(iterName)),
        ]);
        const loopIter = whileAST(
          notEq(index(iterName, atomAST('length', pos)), number(0, pos)),
          loopBody,
          pos
        );

        return block(
          sequence([declareIter, declareMapped, loopIter, mappedName]),
          getPosition(ast)
        );
      }

      case NodeType.WHILE: {
        const [condition, body] = ast.children;
        if (!condition || !body) return ast;

        const position = getPosition(condition);
        const stop = application(
          nameAST('break', position),
          placeholder(position)
        );
        return loop(
          ifElse(condition, body, stop, getPosition(ast)),
          getPosition(ast)
        );
      }

      case NodeType.LOOP: {
        let [body] = ast.children;
        if (!body) return ast;
        if (body.type === NodeType.BLOCK) {
          body = body.children[0]!;
        }

        const position = getPosition(body);
        const keepGoing = application(
          nameAST('continue', position),
          placeholder(position)
        );
        return block(sequence([body, keepGoing]), getPosition(ast));
      }

      case NodeType.PIPE: {
        const args = ast.children.slice();
        const fn = args.pop();
        assert(fn, 'expected piped function');
        assert(args.length >= 1, 'expected at least one more argument');

        return application(
          fn,
          args.length === 1 ? args[0]! : node(NodeType.PIPE, { children: args })
        );
      }

      default:
        return ast;
    }
  };

  // let step = lower(ast);

  // while (step !== ast) {
  //   ast = step;
  //   step = lowerStep(ast);
  // }

  // return { ...step, children: step.children.map(lower) };

  return lowerStep(ast);
};
