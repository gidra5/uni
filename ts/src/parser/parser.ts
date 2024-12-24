import { SystemError } from "../error.js";
import { indexPosition, position, mapListPosToPos, mergePositions, Position } from "../utils/position.js";
import {
  Tree,
  block,
  error,
  implicitPlaceholder,
  NodeType,
  node as _node,
  script,
  module,
  token,
  Precedence,
  getExprPrecedence as _getExprPrecedence,
  getPatternPrecedence as _getPatternPrecedence,
} from "../ast.js";
import { inject, Injectable } from "../utils/injector.js";
import { TokenGroupKind, type TokenGroup } from "./tokenGroups.js";
import { Parser, type ParserGenerator } from "./utils.js";
import { assert } from "../utils/index.js";

export const getExprPrecedence = (node: Tree): Precedence =>
  inject(Injectable.ASTNodePrecedenceMap).get(node.id) ?? _getExprPrecedence(node.type);

export const getPatternPrecedence = (node: Tree): Precedence =>
  inject(Injectable.ASTNodePrecedenceMap).get(node.id) ?? _getPatternPrecedence(node.type);

export const getTokenPosition = (token: TokenGroup): Position => {
  if (token.type === "error") return getTokenPosition(token.token);
  const map = inject(Injectable.PositionMap);
  if (map.has(token.id)) return map.get(token.id)!;
  assert(token.type === "group");
  const childrenPosition = token.tokens.map(getTokenPosition);
  return mergePositions(...childrenPosition);
};

export const getPosition = (node: Tree): Position => {
  const map = inject(Injectable.PositionMap);
  if (map.has(node.id)) return map.get(node.id)!;
  const childrenPosition = node.children.map(getPosition);
  return mergePositions(...childrenPosition);
};

const infix = (group: Tree, lhs: Tree, rhs: Tree): Tree => {
  const { children } = group;
  return { ...group, children: [lhs, ...children, rhs] };
};

const postfix = (group: Tree, lhs: Tree): Tree => {
  const { children } = group;
  return { ...group, children: [lhs, ...children] };
};

const prefix = (group: Tree, rhs: Tree): Tree => {
  const { children } = group;
  return { ...group, children: [...children, rhs] };
};

const idToExprOp = {
  "+": NodeType.ADD,
  "-": NodeType.SUB,
  "*": NodeType.MULT,
  "/": NodeType.DIV,
  "%": NodeType.MOD,
  "^": NodeType.POW,
  "==": NodeType.EQUAL,
  "!=": NodeType.NOT_EQUAL,
  "===": NodeType.DEEP_EQUAL,
  "!==": NodeType.DEEP_NOT_EQUAL,
  "<": NodeType.LESS,
  "<=": NodeType.LESS_EQUAL,
  ">": NodeType.GREATER,
  ">=": NodeType.GREATER_EQUAL,
  "++": NodeType.POST_INCREMENT,
  "--": NodeType.POST_DECREMENT,
  "?": NodeType.TRY,
  "->": NodeType.FUNCTION,
  ",": NodeType.TUPLE,
  ":": NodeType.LABEL,
  ";": NodeType.SEQUENCE,
  "<-": NodeType.SEND,
  "?<-": NodeType.SEND_STATUS,
  "|": NodeType.PARALLEL,
  "|>": NodeType.PIPE,
  and: NodeType.AND,
  or: NodeType.OR,
  in: NodeType.IN,
};

const idToPrefixExprOp = {
  "!": NodeType.NOT,
  "-": NodeType.MINUS,
  "+": NodeType.PLUS,
  "++": NodeType.INCREMENT,
  "--": NodeType.DECREMENT,
  "...": NodeType.SPREAD,
  "<-": NodeType.RECEIVE,
  "<-?": NodeType.RECEIVE_STATUS,
  not: NodeType.NOT,
  async: NodeType.ASYNC,
  await: NodeType.AWAIT,
  loop: NodeType.LOOP,
  export: NodeType.EXPORT,
};

// const idToLhsPatternExprOp = {
//   "->": NodeType.FUNCTION,
//   ":=": NodeType.DECLARE,
//   "=": NodeType.ASSIGN,
//   "+=": NodeType.INC_ASSIGN,
// };

// const idToPatternOp = {
//   ",": NodeType.TUPLE,
//   ":": NodeType.LABEL,
//   "@": NodeType.BIND,
// };

// const idToPrefixPatternOp = {
//   "...": NodeType.SPREAD,
//   ":": NodeType.ATOM,
//   export: NodeType.EXPORT,
//   mut: NodeType.MUTABLE,
//   like: NodeType.LIKE,
//   strict: NodeType.STRICT,
//   not: NodeType.NOT,
//   "!": NodeType.NOT,
// };

const tokenIncludes = (token: TokenGroup | undefined, tokens: string[]): boolean => {
  if (token === undefined) return false;
  if (token.type === "identifier") return tokens.includes(token.name);

  return tokens.includes("\n") && token.type === "newline";
};

type Context3 = {
  groupParser: Parser<TokenGroup[], Tree, { lhs: boolean }>;
  getPrecedence: (node: Tree) => Precedence;
  precedence: number;
  followSet: string[];
};
// type Context = Readonly<{
//   lhs: boolean;
//   allowPatternDefault: boolean;
//   followSet: string[];
//   banned: string[];
// }>;

// const newContext = ({ banned = [] }: Partial<Context> = {}): Context => ({
//   lhs: false,
//   allowPatternDefault: false,
//   followSet: [],
//   banned,
// });

// type ContextParser = (context: Context) => ParserFunction<TokenGroup[], Tree>;

const parseValue = Parser.do<TokenGroup[], Tree>(function* () {
  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: TokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };
  const _token: TokenGroup = yield Parser.peek();

  if (yield Parser.identifier("$")) {
    if (yield Parser.isEnd()) return error(SystemError.endOfSource(yield * nodePosition()), yield * nodePosition());
    const token2: TokenGroup | undefined = yield Parser.peek();
    if (token2?.type !== "identifier")
      return error(SystemError.invalidPattern(yield * nodePosition()), yield * nodePosition());
    yield Parser.advance();
    return _node(NodeType.ATOM, { data: { name: token2.name }, position: yield * nodePosition() });
  }

  const token2 = yield Parser.peek(1);
  if (_token.type === "identifier" && token2?.type === "identifier" && token2.name === "::") {
    yield Parser.advance(2);
    return _node(NodeType.CODE_LABEL, { position: yield * nodePosition(), data: { name: _token.name } });
  }

  yield Parser.advance();
  return token(_token, yield* nodePosition());
});

const parseStatementForm = (innerParser: Parser<TokenGroup[], Tree, {}>) =>
  Parser.do<TokenGroup[], [inner: Tree, expr: Tree | null]>(function* () {
    const _token: TokenGroup = yield Parser.next();
    assert(_token.type === "group");
    const [innerGroup, formToken] = _token.tokens;
    assert(innerGroup.type === "group");
    assert(formToken.type === "group");
    assert("kind" in formToken);

    const [conditionParseCtx, inner] = innerParser.parse(innerGroup.tokens, { index: 0 });
    assert(conditionParseCtx.index === innerGroup.tokens.length);

    return yield Parser.do(function* () {
      if (formToken.kind === TokenGroupKind.Colon) return [inner, null];
      if (formToken.kind === TokenGroupKind.Braces) {
        const [exprParseCtx, expr] = parseExpr.parse(formToken.tokens, { index: 0 });
        assert(exprParseCtx.index === formToken.tokens.length);
        return [inner, expr];
      }
      if (formToken.kind === TokenGroupKind.Arrow) {
        const precedence = _getExprPrecedence(NodeType.SEQUENCE);
        return [inner, yield Parser.scope({ precedence: precedence[1]! - 1 }, parsePratt)];
      }
    });
  });

// const parsePatternGroup: ContextParser = (context) => (src, i) => {
//   let index = i;
//   const start = index;
//   const nodePosition = () => mapListPosToPos(position(start, index), src);

//   if (!context.lhs && Object.hasOwn(idToPrefixPatternOp, src[index].src)) {
//     const op = idToPrefixPatternOp[src[index].src];
//     index++;
//     return [index, _node(op, { position: nodePosition() })];
//   }

//   if (context.lhs && Object.hasOwn(idToPatternOp, src[index].src)) {
//     const op = idToPatternOp[src[index].src];
//     index++;
//     return [index, _node(op)];
//   }

//   if (src[index].src === "{") {
//     const node = (pattern: Tree) => {
//       const node = _node(NodeType.RECORD, {
//         position: nodePosition(),
//       });
//       if (pattern.type === NodeType.TUPLE) node.children = pattern.children;
//       else node.children.push(pattern);

//       return node;
//     };

//     return parsePairGroup({ ...context, allowPatternDefault: true }, ["{", "}"], parsePattern, node)(src, index);
//   }

//   if (src[index].src === "(") {
//     const node = (pattern: Tree) => _node(NodeType.PARENS, { position: nodePosition(), children: [pattern] });
//     return parsePairGroup({ ...context, allowPatternDefault: true }, ["(", ")"], parsePattern, node)(src, index);
//   }

//   if (src[index].src === "[") {
//     const node = (expr: Tree) =>
//       _node(context.lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
//         position: nodePosition(),
//         children: [expr],
//       });

//     return parsePairGroup(context, ["[", "]"], parseExpr, node)(src, index);
//   }

//   if (context.allowPatternDefault && context.lhs && src[index].src === "=") {
//     index++;
//     let value: Tree;
//     [index, value] = parsePrattGroup({ ...context, lhs: false }, parseExprGroup, getExprPrecedence)(src, index);
//     const node = _node(NodeType.ASSIGN, {
//       position: nodePosition(),
//       children: [value],
//     });
//     const precedence = getExprPrecedence(value);
//     if (precedence[0] !== null || precedence[1] !== null) {
//       return [index, error(SystemError.invalidDefaultPattern(nodePosition()), node)];
//     }

//     return [index, node];
//   }

//   if (!context.lhs && src[index].src === "^") {
//     index++;
//     let value: Tree;
//     [index, value] = parsePrattGroup(context, parseExprGroup, getExprPrecedence)(src, index);
//     const node = _node(NodeType.PIN, {
//       position: nodePosition(),
//       children: [value],
//     });
//     const precedence = getExprPrecedence(value);
//     if (precedence[0] !== null && precedence[1] !== null) {
//       return [index, error(SystemError.invalidPinPattern(nodePosition()), node)];
//     }

//     return [index, node];
//   }

//   if (context.lhs && src[index].src === ".") {
//     index++;
//     const next = src[index];
//     if (!tokenIncludes(next, context.followSet) && next?.type === "identifier") {
//       index++;
//       const key = atom(next.src, { start: next.start, end: next.end });
//       return [
//         index,
//         _node(NodeType.INDEX, {
//           position: nodePosition(),
//           children: [key],
//         }),
//       ];
//     }
//     return [index, error(SystemError.invalidIndex(nodePosition()), nodePosition())];
//   }

//   return parseValue(src, i);
// };

const parseExprGroup: Parser<TokenGroup[], Tree, { lhs: boolean }> = Parser.do(function* () {
  const { lhs }: { lhs: boolean } = yield Parser.ctx();
  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: TokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };

  const _token: TokenGroup = yield Parser.peek();

  // if (token.type === "identifier" && token.name === "import") {
  //   yield Parser.advance();
  //   const nameToken: TokenGroup | undefined = yield Parser.peek();
  //   if (nameToken?.type !== "string") {
  //     return _node(NodeType.IMPORT, { position: yield* nodePosition() });
  //   }

  //   yield Parser.advance();
  //   const name = nameToken.value;
  //   const pattern: Tree | null = yield Parser.peek<TokenGroup>().chain(function* (next) {
  //     if (next?.type === "identifier" && next.name === "as") {
  //       yield Parser.advance();
  //       return yield parsePattern;
  //     }
  //     return null;
  //   });

  //   const node = _node(NodeType.IMPORT, { position: yield* nodePosition() });
  //   node.data.name = name;
  //   if (pattern) node.children.push(pattern);
  //   inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
  //   return node;
  // }

  // if (lhs && token.type === "identifier" && token.name === "is") {
  //   yield Parser.advance();
  //   const pattern: Tree = yield parsePattern;
  //   return _node(NodeType.IS, { position: yield* nodePosition(), children: [pattern] });
  // }

  // if (!lhs && token.type === "group" && "kind" in token && token.kind === TokenGroupKind.Function) {
  //   yield Parser.advance();
  //   const [patternGroup, formToken] = token.tokens;
  //   assert(patternGroup.type === "group");
  //   assert(formToken.type === "group");
  //   assert("kind" in formToken);

  //   const [patternParseCtx, pattern] = parsePattern.parse(patternGroup.tokens, { index: 0 });
  //   assert(patternParseCtx.index === patternGroup.tokens.length);

  //   return yield Parser.do(function* () {
  //     if (formToken.kind === TokenGroupKind.Colon) return null;
  //     if (formToken.kind === TokenGroupKind.Braces) {
  //       const [exprParseCtx, expr] = parseExpr.parse(formToken.tokens, { index: 0 });
  //       assert(exprParseCtx.index === formToken.tokens.length);
  //       return expr;
  //     }
  //     if (formToken.kind === TokenGroupKind.Arrow) {
  //       const precedence = _getExprPrecedence(NodeType.SEQUENCE);
  //       return yield Parser.scope({ precedence: precedence[1]! - 1 }, parsePratt);
  //     }
  //   }).chain(function* (expr: Tree | null) {
  //     if (!expr) {
  //       return _node(NodeType.FUNCTION, {
  //         position: yield* nodePosition(),
  //         children: [pattern],
  //         data: { isTopFunction: true },
  //       });
  //     }

  //     const node = _node(NodeType.FUNCTION, {
  //       position: yield* nodePosition(),
  //       children: [pattern, expr],
  //       data: { isTopFunction: true },
  //     });
  //     inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
  //     return node;
  //   });
  // }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.If) {
    return yield parseStatementForm(parseExpr).chain(function* ([condition, trueBranch]) {
      return yield Parser.do(function* () {
        if (!trueBranch) {
          yield Parser.rememberIndex();

          yield Parser.appendFollow("else");
          let body: Tree = yield parseExpr as any;
          yield Parser.popFollow();
          if (yield Parser.checkIdentifier("else")) return body;

          yield Parser.resetIndex();
        }

        return trueBranch;
      }).chain(function* (trueBranch: Tree | null) {
        if (!trueBranch) {
          return _node(NodeType.IF, {
            position: yield* nodePosition(),
            children: [condition],
          });
        }

        if (yield Parser.identifier("else") as any) {
          return _node(NodeType.IF_ELSE, {
            position: yield* nodePosition(),
            children: [condition, trueBranch],
          });
        }

        const token2: TokenGroup | undefined = yield Parser.peek(1);
        if ((yield Parser.checkNewline()) && token2?.type === "identifier" && token2.name === "else") {
          yield Parser.advance(2);
          return _node(NodeType.IF_ELSE, {
            position: yield* nodePosition(),
            children: [condition, trueBranch],
          });
        }

        const node = _node(NodeType.IF, {
          position: yield* nodePosition(),
          children: [condition, trueBranch],
        });
        inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
        return node;
      });
    });
  }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.While) {
    return yield parseStatementForm(parseExpr).chain(function* ([condition, expr]) {
      if (!expr) {
        return _node(NodeType.WHILE, {
          position: yield* nodePosition(),
          children: [condition],
        });
      }

      const node = _node(NodeType.WHILE, {
        position: yield* nodePosition(),
        children: [condition, expr],
      });
      inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  // if (!lhs && token.type === "group" && "kind" in token && token.kind === TokenGroupKind.ForIn) {
  //   yield Parser.advance();
  //   const [patternGroup, exprGroup, formToken] = token.tokens;
  //   assert(patternGroup.type === "group");
  //   assert(exprGroup.type === "group");
  //   assert(formToken.type === "group");
  //   assert("kind" in formToken);
  //   const [patternParseCtx, pattern] = parsePattern.parse(patternGroup.tokens, { index: 0 });
  //   assert(patternParseCtx.index === patternGroup.tokens.length);
  //   const [exprParseCtx, expr] = parseExpr.parse(exprGroup.tokens, { index: 0 });
  //   assert(exprParseCtx.index === exprGroup.tokens.length);

  //   return yield Parser.do(function* () {
  //     if (formToken.kind === TokenGroupKind.Colon) return null;
  //     if (formToken.kind === TokenGroupKind.Braces) {
  //       const [exprParseCtx, expr] = parseExpr.parse(formToken.tokens, { index: 0 });
  //       assert(exprParseCtx.index === formToken.tokens.length);
  //       return expr;
  //     }
  //     if (formToken.kind === TokenGroupKind.Arrow) {
  //       const precedence = _getExprPrecedence(NodeType.SEQUENCE);
  //       return yield Parser.scope({ precedence: precedence[1]! - 1 }, parsePratt);
  //     }
  //   }).chain(function* (body: Tree | null) {
  //     if (!body) {
  //       return _node(NodeType.FOR, {
  //         position: yield* nodePosition(),
  //         children: [pattern, expr],
  //       });
  //     }

  //     const node = _node(NodeType.FOR, {
  //       position: yield* nodePosition(),
  //       children: [pattern, expr, body],
  //     });
  //     inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);

  //     return node;
  //   });
  // }

  // if (!lhs && token.type === "group" && "kind" in token && token.kind === TokenGroupKind.Match) {
  //   yield Parser.advance();
  //   const [valueGroup, bodyGroup] = token.tokens;
  //   assert(valueGroup.type === "group");
  //   assert(bodyGroup.type === "group");
  //   const [valueParseCtx, value] = parseExpr.parse(valueGroup.tokens, { index: 0 });
  //   assert(valueParseCtx.index === valueGroup.tokens.length);

  //   const [bodyParseCtx, cases] = Parser.do<TokenGroup[], Tree>(function* () {
  //     yield Parser.newline();

  //     // banned: ["->"]
  //     let pattern: Tree = yield parsePattern;
  //     yield Parser.identifier("->");

  //     // else error missing ->
  //     // banned: [";", '\n']
  //     let body: Tree = yield parseExpr;
  //     yield Parser.newline();
  //     yield Parser.identifier(";");

  //     return _node(NodeType.MATCH_CASE, { children: [pattern, body] });
  //   })
  //     .zeroOrMore()
  //     .parse(bodyGroup.tokens, { index: 0 });
  //   assert(bodyParseCtx.index === bodyGroup.tokens.length);

  //   return _node(NodeType.MATCH, { children: [value, ...cases] });
  // }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Inject) {
    return yield parseStatementForm(parseExpr).chain(function* ([expr, body]) {
      if (!body) {
        return _node(NodeType.INJECT, {
          position: yield* nodePosition(),
          children: [expr],
        });
      }

      const node = _node(NodeType.INJECT, {
        position: yield* nodePosition(),
        children: [expr, body],
      });
      inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Without) {
    return yield parseStatementForm(parseExpr).chain(function* ([expr, body]) {
      if (!body) {
        return _node(NodeType.WITHOUT, {
          position: yield* nodePosition(),
          children: [expr],
        });
      }

      const node = _node(NodeType.WITHOUT, {
        position: yield* nodePosition(),
        children: [expr, body],
      });
      inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Mask) {
    return yield parseStatementForm(parseExpr).chain(function* ([expr, body]) {
      if (!body) {
        return _node(NodeType.MASK, {
          position: yield* nodePosition(),
          children: [expr],
        });
      }

      const node = _node(NodeType.MASK, {
        position: yield* nodePosition(),
        children: [expr, body],
      });
      inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  // if (!lhs) {
  //   yield Parser.rememberIndex();
  //   const pattern: Tree = yield parsePattern;
  //   const next: TokenGroup | undefined = yield Parser.peek();

  //   if (
  //     next &&
  //     next.type === "identifier" &&
  //     pattern.type !== NodeType.ERROR &&
  //     Object.hasOwn(idToLhsPatternExprOp, next.name)
  //   ) {
  //   }
  // }

  if (!lhs && _token.type === "identifier" && Object.hasOwn(idToPrefixExprOp, _token.name)) {
    const op = idToPrefixExprOp[_token.name];
    yield Parser.advance();
    return _node(op, { position: yield* nodePosition() });
  }

  if (lhs && _token.type === "identifier" && Object.hasOwn(idToExprOp, _token.name)) {
    const op = idToExprOp[_token.name];
    yield Parser.advance();
    return _node(op);
  }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Braces) {
    yield Parser.advance();
    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return block(expr, yield* nodePosition());
  }

  if (_token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Brackets) {
    yield Parser.advance();
    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
      position: yield* nodePosition(),
      children: [expr],
    });
  }

  if (!lhs && _token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Parentheses) {
    yield Parser.advance();
    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return _node(NodeType.PARENS, { position: yield* nodePosition(), children: [expr] });
  }

  // if (!lhs) {
  //   const [nextIndex, pattern] = parsePattern(context)(src, index);
  //   if (
  //     src[nextIndex] &&
  //     !tokenIncludes(src[nextIndex], context.followSet) &&
  //     pattern.type !== NodeType.ERROR &&
  //     Object.hasOwn(idToLhsPatternExprOp, src[nextIndex].src)
  //   ) {
  //     const op = idToLhsPatternExprOp[src[nextIndex].src];
  //     return [nextIndex + 1, _node(op, { position: nodePosition(), children: [pattern] })];
  //   }
  // }

  if (lhs) {
    const node = _node(NodeType.APPLICATION);

    // if function call is with parentheses, make precedence higher than field access
    // so method chaining works as usual
    if (_token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Parentheses) {
      const indexPrecedence = _getExprPrecedence(NodeType.INDEX);
      const applicationPrecedence = _getExprPrecedence(NodeType.APPLICATION);
      inject(Injectable.ASTNodePrecedenceMap).set(node.id, [applicationPrecedence[0], indexPrecedence[0]! + 1]);
    }

    return node;
  }

  // if (lhs && src[index].type === "newline") {
  //   index++;

  //   if (!src[index]) return [index, _node(NodeType.SEQUENCE)];

  //   if (lhs && Object.hasOwn(idToExprOp, src[index].src)) {
  //     const op = idToExprOp[src[index].src];
  //     index++;
  //     return [index, _node(op)];
  //   }

  //   if (lhs && src[index].src === ".") {
  //     index++;
  //     const next = src[index];
  //     if (!tokenIncludes(next, context.followSet) && next?.type === "identifier") {
  //       index++;
  //       const key = atom(next.src, { start: next.start, end: next.end });
  //       return [
  //         index,
  //         _node(NodeType.INDEX, {
  //           position: nodePosition(),
  //           children: [key],
  //         }),
  //       ];
  //     }
  //     return [index, error(SystemError.invalidIndex(nodePosition()), nodePosition())];
  //   }

  //   return [index, _node(NodeType.SEQUENCE)];
  // }

  // if (!lhs && src[index].src === "|") {
  //   index++;
  //   return parsePrattGroup(context, parseExprGroup, getExprPrecedence)(src, index);
  // }

  // if (lhs && src[index].src === ".") {
  //   index++;
  //   const next = src[index];
  //   if (!tokenIncludes(next, context.followSet) && next?.type === "identifier") {
  //     index++;
  //     const key = atom(next.src, { start: next.start, end: next.end });
  //     return [
  //       index,
  //       _node(NodeType.INDEX, {
  //         position: nodePosition(),
  //         children: [key],
  //       }),
  //     ];
  //   }
  //   return [index, error(SystemError.invalidIndex(nodePosition()), nodePosition())];
  // }

  // if (!lhs && Object.hasOwn(idToExprOp, src[index].src)) {
  //   const name = src[index].src;
  //   const op = idToExprOp[name];
  //   index++;
  //   const position = nodePosition();
  //   const node = error(
  //     SystemError.infixOperatorInPrefixPosition(name, op, position),
  //     _node(op, { position, children: [implicitPlaceholder(position)] })
  //   );
  //   const precedence = _getExprPrecedence(op);
  //   inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, precedence[1]]);
  //   return [index, node];
  // }

  if (_token.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.StringTemplate) {
    yield Parser.advance();
    if (_token.tokens.length === 1) {
      return token(_token.tokens[0], yield* nodePosition());
    }
    const children: Tree[] = [];
    for (const __token of _token.tokens) {
      if (__token.type === "string") {
        children.push(token(__token, yield* nodePosition()));
      } else {
        assert(__token.type === "group");
        assert("kind" in __token);
        assert(__token.kind === TokenGroupKind.Parentheses);
        const [exprParseCtx, expr] = parseExpr.parse(__token.tokens, { index: 0 });
        assert(exprParseCtx.index === __token.tokens.length);
        children.push(expr);
      }
    }
    const node = _node(NodeType.TEMPLATE, { position: yield* nodePosition(), children });
    inject(Injectable.ASTNodePrecedenceMap).set(node.id, [null, null]);
    return node;
  }

  return yield parseValue;
});

const parsePrattGroup = function* (): ParserGenerator<TokenGroup[], any, Tree, Context3> {
  const { groupParser, followSet }: Context3 = yield Parser.ctx();
  const start = yield Parser.index();
  const nodePosition = function* (): ParserGenerator<TokenGroup[], any, Position, Context3> {
    const index = yield Parser.index();
    const src: TokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };

  if (yield Parser.isEnd()) {
    const position = yield* nodePosition();
    return error(SystemError.endOfSource(position), position);
  }

  if (tokenIncludes(yield Parser.peek(), followSet)) return implicitPlaceholder(yield* nodePosition());

  const node: Tree = yield groupParser as any;
  return node;
};

const parsePrefix: Parser<TokenGroup[], Tree, Context3> = Parser.do(function* self() {
  {
    const token: TokenGroup | undefined = yield Parser.peek();
    if (token?.type === "newline") yield Parser.advance();
  }

  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: TokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };

  if (yield Parser.isEnd()) {
    const position = yield* nodePosition();
    return error(SystemError.endOfSource(position), position);
  }

  const { getPrecedence }: Context3 = yield Parser.ctx();

  const group: Tree = yield Parser.scope({ lhs: false }, parsePrattGroup as any);
  const [, right] = getPrecedence(group);
  if (right === null) return group;

  const rhs: Tree = yield Parser.scope({ precedence: right }, self);

  if (group.type === NodeType.ERROR) {
    const node = group.children[0];
    group.children[0] = prefix(node, rhs);
    return group;
  }

  if (rhs.type === NodeType.ERROR && rhs.children.length === 0) {
    const position = yield* nodePosition();
    const node = prefix(group, implicitPlaceholder(position));
    const errorNode = error(SystemError.missingOperand(position).withCause(rhs.data.cause), node);
    return errorNode;
  }

  return prefix(group, rhs);
});

const parsePratt = function* self() {
  const { getPrecedence, precedence, followSet }: Context3 = yield Parser.ctx();
  let lhs: Tree = yield parsePrefix;
  const until = function* () {
    if (yield Parser.isEnd()) return false;
    if (followSet.length === 0) return true;
    return !tokenIncludes(yield Parser.peek(), followSet);
  };

  while (yield* until()) {
    const opGroup: Tree = yield Parser.scope({ lhs: true }, parsePrattGroup as any);
    const [left, right] = getPrecedence(opGroup);
    if (left === null) break;
    if (left <= precedence) break;

    if (right === null) {
      lhs = postfix(opGroup, lhs);
      continue;
    }

    if (opGroup.type === NodeType.SEQUENCE) {
      const token: TokenGroup | undefined = yield Parser.peek();
      if (token?.type === "newline") yield Parser.advance();
      if (yield Parser.isEnd()) break;
    }

    const rhs: Tree = yield Parser.scope({ precedence: right }, self);

    if (rhs.type === NodeType.ERROR && rhs.children.length === 0) {
      const position = indexPosition(yield Parser.index());
      const node = infix(opGroup, lhs, implicitPlaceholder(position));
      const errorNode = error(SystemError.missingOperand(position).withCause(rhs.data.cause), node);
      return errorNode;
    }

    // if two same operators are next to each other, and their precedence is the same on both sides
    // so it is both left and right associative
    // which means we can put all arguments into one group
    const associative = left === right;
    const hasSameOperator = opGroup.type === lhs.type;
    const isPlaceholder = rhs.type === NodeType.IMPLICIT_PLACEHOLDER;

    if (associative && hasSameOperator && !isPlaceholder) {
      lhs.children.push(rhs);
    } else if (!isPlaceholder) {
      lhs = infix(opGroup, lhs, rhs);
    } else if (!(associative && hasSameOperator)) {
      lhs = postfix(opGroup, lhs);
    }
  }

  if (lhs.type === NodeType.SEQUENCE && lhs.children.length === 1) {
    return lhs.children[0];
  }

  return lhs;
};

const parseExpr = Parser.scope<TokenGroup[], Tree, {}, Context3>(
  { groupParser: parseExprGroup, getPrecedence: getExprPrecedence, precedence: 0, followSet: [] },
  parsePratt
);
// const parsePattern = Parser.scope<TokenGroup[], Tree, {}, Context3>(
//   {
//     allowPatternDefault: false,
//     groupParser: parsePatternGroup,
//     getPrecedence: getPatternPrecedence,
//     precedence: 0,
//     followSet: [],
//   },
//   parsePratt
// );

export const parseScript = (src: TokenGroup[]) =>
  Parser.do(function* () {
    const expr = yield parseExpr;
    if (expr.type === NodeType.SEQUENCE) return script(expr.children);
    return script([expr]);
  }).parse(src, { index: 0 })[1];

// const parseDeclaration: ParserFunction<TokenGroup[], Tree> = (src, i) => {
//   const context = newContext({ banned: [";"] });
//   return parseExpr(context)(src, i);
// };

export const parseModule = (src: TokenGroup[]) => {
  const children: Tree[] = [];
  // let lastExport: Tree | null = null;
  // let index = 0;

  // while (src[index]) {
  //   if (tokenIncludes(src[index], ["\n", ";"])) {
  //     index++;
  //     continue;
  //   }
  //   let node: Tree;
  //   [index, node] = parseDeclaration(src, index);
  //   if (node.type === NodeType.EXPORT) {
  //     if (node.children[0].type === NodeType.DECLARE) {
  //       children.push(node);
  //       continue;
  //     }
  //     if (lastExport) {
  //       const errorNode = error(SystemError.duplicateDefaultExport(getPosition(lastExport)), lastExport);
  //       children.push(errorNode);
  //     }
  //     lastExport = node;
  //   } else children.push(node);
  // }

  // if (lastExport) children.push(lastExport);
  return module(children.flatMap((node) => (node.type === "sequence" ? node.children : [node])));
};

// if (import.meta.vitest) {
//   const { expect } = import.meta.vitest;
//   const { it, fc } = await import("@fast-check/vitest");
//   const { tokenArbitrary, tokenListArbitrary } = await import("../src/testing.js");
//   const zeroPos = { start: 0, end: 0 };
//   const arb1 = fc.oneof(fc.constant(["(", ")"]), fc.constant(["[", "]"]), fc.constant(["{", "}"]));

//   it.prop([fc.array(tokenArbitrary)])("module parsing never throws", (tokens) => {
//     try {
//       parseModule(tokens.map((t) => ({ ...t, ...zeroPos })));
//     } catch (e) {
//       const msg = e instanceof Error ? e.stack : e;
//       expect.unreachable(msg as string);
//     }
//   });

//   it.prop([fc.array(tokenArbitrary)])("script parsing never throws", (tokens) => {
//     try {
//       parseScript(tokens.map((t) => ({ ...t, ...zeroPos })));
//     } catch (e) {
//       const msg = e instanceof Error ? e.stack : e;
//       expect.unreachable(msg as string);
//     }
//   });

//   it.prop([fc.array(tokenArbitrary)])("module is always flat sequence", (tokens) => {
//     tokens = tokens.map((t) => ({ ...t, ...zeroPos }));
//     let ast = parseModule(tokens as Token[]);
//     expect(ast.children.every((node) => (node as Tree).type !== "sequence")).toBe(true);
//   });

//   it.prop([fc.array(tokenArbitrary)])("script is always flat sequence", (tokens) => {
//     tokens = tokens.map((t) => ({ ...t, ...zeroPos }));
//     let ast = parseScript(tokens as Token[]);
//     expect(ast.children.every((node) => (node as Tree).type !== "sequence")).toBe(true);
//   });

//   const arb2 = arb1.chain(([open, close]) =>
//     tokenListArbitrary
//       .filter((tokens) => !tokens.some((t) => t.src !== open && t.src !== close))
//       .map((tokens) => [{ type: "identifier", src: open }, ...tokens, { type: "identifier", src: close }])
//   );

//   it.prop([arb2])("pattern parsing always bound by paired tokens", (tokens) => {
//     const patternType =
//       tokens[0].src === "[" ? NodeType.SQUARE_BRACKETS : tokens[0].src === "{" ? NodeType.RECORD : NodeType.PARENS;

//     tokens = tokens.map((t) => ({ ...t, ...zeroPos }));
//     let ast = parsePattern(newContext())(tokens as Token[], 0)[1];
//     expect(ast).toMatchObject({ type: patternType });
//   });

//   it.prop([arb2])("expr parsing always bound by paired tokens", (tokens) => {
//     const exprType =
//       tokens[0].src === "(" ? NodeType.PARENS : tokens[0].src === "{" ? NodeType.BLOCK : NodeType.SQUARE_BRACKETS;

//     tokens = tokens.map((t) => ({ ...t, ...zeroPos }));

//     let ast = parseExpr(newContext())(tokens as Token[], 0)[1];
//     expect(ast).toMatchObject({ type: exprType });
//   });
// }
