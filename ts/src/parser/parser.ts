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
  atom,
} from "../ast.js";
import { inject, Injectable } from "../utils/injector.js";
import { TokenGroupKind, ValidatedTokenGroup } from "./tokenGroups.js";
import { Parser, type ParserGenerator } from "./utils.js";
import { assert, getPos } from "../utils/index.js";

export const getExprPrecedence = (node: Tree): Precedence =>
  inject(Injectable.PrecedenceMap).get(node.id) ?? _getExprPrecedence(node.type);

export const getPatternPrecedence = (node: Tree): Precedence =>
  inject(Injectable.PrecedenceMap).get(node.id) ?? _getPatternPrecedence(node.type);

export const getTokenPosition = (token: ValidatedTokenGroup): Position => {
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
  "<-?": NodeType.SEND_STATUS,
  "|": NodeType.PARALLEL,
  "&": NodeType.SUPERPOSITION,
  "|>": NodeType.PIPE,
  ":>": NodeType.COALESCE,
  and: NodeType.AND,
  or: NodeType.OR,
  in: NodeType.IN,
  as: NodeType.AS,
};

const idToPrefixExprOp = {
  "!": NodeType.NOT,
  "-": NodeType.MINUS,
  "+": NodeType.PLUS,
  "++": NodeType.INCREMENT,
  "--": NodeType.DECREMENT,
  "...": NodeType.SPREAD,
  "*": NodeType.DEREF,
  "<-": NodeType.RECEIVE,
  "<-?": NodeType.RECEIVE_STATUS,
  not: NodeType.NOT,
  async: NodeType.ASYNC,
  await: NodeType.AWAIT,
  loop: NodeType.LOOP,
  typeof: NodeType.TYPEOF,
  export: NodeType.EXPORT,
};

const idToLhsPatternExprOp = {
  "->": NodeType.FUNCTION,
  ":=": NodeType.DECLARE,
  "=": NodeType.ASSIGN,
  "+=": NodeType.INC_ASSIGN,
};

const idToPatternOp = {
  ",": NodeType.TUPLE,
  ":": NodeType.LABEL,
  "@": NodeType.BIND,
};

const idToPatternOp2 = {
  and: NodeType.AND,
  or: NodeType.OR,
};

const idToPrefixPatternOp = {
  "...": NodeType.SPREAD,
  export: NodeType.EXPORT,
  unexport: NodeType.UNEXPORT,
  mut: NodeType.MUTABLE,
  const: NodeType.CONST,
  type: NodeType.TYPE,
  like: NodeType.LIKE,
  strict: NodeType.STRICT,
  not: NodeType.NOT,
  "!": NodeType.NOT,
};

const tokenIncludes = (token: ValidatedTokenGroup | undefined, tokens: string[]): boolean => {
  if (token === undefined) return false;
  if (token.type === "identifier") return tokens.includes(token.name);

  return tokens.includes("\n") && token.type === "newline";
};

type Context3 = {
  groupParser: Parser<ValidatedTokenGroup[], Tree, any /* { lhs: boolean } */>;
  getPrecedence: (node: Tree) => Precedence;
  precedence: number;
  followSet: string[];
};

type Context2 = {
  lhs: boolean;
  isDeepPattern: boolean; // is pattern inside of parens or any other pattern grouping
};

type PathDescriptorSegment = { type: "previous" } | { type: "segment"; name: string };
type PathDescriptor =
  | { segments: PathDescriptorSegment[]; type: "absolute" | "relative" }
  | { segments: PathDescriptorSegment[]; type: "dependency"; name: string };

const parseImportDescriptor = (path: string): PathDescriptor => {
  const segments = path.split("/");
  const pathSegments: PathDescriptorSegment[] = [];

  if (segments[0] === "" && segments.length === 1) {
    return { segments: [], type: "dependency", name: segments[0] };
  }

  if (segments[segments.length - 1] === "") segments.pop();

  for (const segment of segments) {
    if (segment === "..") {
      if (pathSegments.some((x) => x.type === "segment" && x.name === ".")) {
        assert(pathSegments.length === 1);
        pathSegments.pop();
        pathSegments.push({ type: "previous" });
        continue;
      }
      if (pathSegments.every((x) => x.type === "previous")) {
        pathSegments.push({ type: "previous" });
        continue;
      }
      pathSegments.pop();
      continue;
    } else if (segment === "." && pathSegments.length > 0) {
      continue;
    }
    pathSegments.push({ type: "segment", name: segment });
  }

  if (pathSegments[0].type === "segment" && pathSegments[0].name === "") {
    pathSegments.shift();
    return { segments: pathSegments, type: "absolute" };
  }
  if (pathSegments[0].type === "segment" && pathSegments[0].name === ".") {
    pathSegments.shift();
    return { segments: pathSegments, type: "relative" };
  }
  if (pathSegments[0].type === "previous") {
    return { segments: pathSegments, type: "relative" };
  }
  const name = pathSegments.shift()!;
  assert(name.type === "segment");
  return { segments: pathSegments, type: "dependency", name: name.name };
};

const parseValue = Parser.do<ValidatedTokenGroup[], Tree>(function* () {
  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: ValidatedTokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };
  const _token: ValidatedTokenGroup | undefined = yield Parser.peek();

  if (yield Parser.identifier("$")) {
    if (yield Parser.isEnd()) return error(SystemError.endOfSource(yield* nodePosition()), yield* nodePosition());
    const token2: ValidatedTokenGroup | undefined = yield Parser.peek();
    if (token2?.type !== "identifier")
      return error(SystemError.invalidPattern(yield* nodePosition()), yield* nodePosition());
    yield Parser.advance();
    return _node(NodeType.ATOM, { data: { name: token2.name }, position: yield* nodePosition() });
  }

  if (yield Parser.identifier("#")) {
    if (yield Parser.isEnd()) return error(SystemError.endOfSource(yield* nodePosition()), yield* nodePosition());
    const count = (yield Parser.identifier("#").zeroOrMore()).length + 1;
    const token2: ValidatedTokenGroup | undefined = yield Parser.peek();
    if (token2?.type === "identifier") {
      yield Parser.advance();
      return _node(NodeType.HASH_NAME, { data: { name: token2.name, count }, position: yield* nodePosition() });
    }
    if (token2?.type === "number") {
      yield Parser.advance();
      const value = token2.value;
      if (!Number.isInteger(value))
        return error(SystemError.invalidPattern(yield* nodePosition()), yield* nodePosition());
      return _node(NodeType.HASH_NAME, { data: { index: token2.value }, position: yield* nodePosition() });
    }
    return error(SystemError.invalidPattern(yield* nodePosition()), yield* nodePosition());
  }

  if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.StringTemplate) {
    yield Parser.advance();
    if (_token.tokens.length === 1 && _token.tokens[0].type === "string") {
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
        if (__token.tokens.length === 0) {
          children.push(error(SystemError.emptyInterpolationExpression(getPos(__token.id)!), getPos(__token.id)!));
          continue;
        }
        const [exprParseCtx, expr] = parseExpr.parse(__token.tokens, { index: 0 });
        assert(exprParseCtx.index === __token.tokens.length);
        children.push(expr);
      }
    }
    const node = _node(NodeType.TEMPLATE, { position: yield* nodePosition(), children });
    inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
    return node;
  }

  const token2 = yield Parser.peek(1);
  if (_token?.type === "identifier" && token2?.type === "identifier" && token2.name === "::") {
    yield Parser.advance(2);
    return _node(NodeType.CODE_LABEL, { position: yield* nodePosition(), data: { name: _token.name } });
  }

  if (!_token) return error(SystemError.endOfSource(yield* nodePosition()), yield* nodePosition());
  yield Parser.advance();
  return token(_token, yield* nodePosition());
});

const parseStatementForm = (innerParser: Parser<ValidatedTokenGroup[], Tree, {}>) =>
  Parser.do<ValidatedTokenGroup[], [inner: Tree, expr: Tree | null], any>(function* () {
    const _token: ValidatedTokenGroup = yield Parser.next();
    assert(_token?.type === "group");
    const [innerGroup, formToken] = _token.tokens;
    assert(innerGroup.type === "group");
    assert(formToken.type === "group");
    assert("kind" in formToken);

    const inner = yield Parser.do(function* () {
      if (innerGroup.tokens.length === 0) return implicitPlaceholder(indexPosition(yield Parser.index()));

      const [exprParseCtx, expr] = innerParser.parse(innerGroup.tokens, { index: 0 });

      if (exprParseCtx.index !== innerGroup.tokens.length) {
        return error(SystemError.unknown(), expr);
      }

      return expr;
    });

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

const parsePatternGroup: Parser<ValidatedTokenGroup[], Tree, Context2> = Parser.do(function* () {
  const { lhs, isDeepPattern }: Context2 = yield Parser.ctx();
  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: ValidatedTokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };

  const _token: ValidatedTokenGroup = yield Parser.peek();

  if (!lhs && _token?.type === "identifier" && Object.hasOwn(idToPrefixPatternOp, _token.name)) {
    const op = idToPrefixPatternOp[_token.name];
    yield Parser.advance();
    return _node(op, { position: yield* nodePosition() });
  }

  if (lhs && _token?.type === "identifier" && Object.hasOwn(idToPatternOp, _token.name)) {
    const op = idToPatternOp[_token.name];
    yield Parser.advance();
    return _node(op);
  }

  if (isDeepPattern && lhs && _token?.type === "identifier" && Object.hasOwn(idToPatternOp2, _token.name)) {
    const op = idToPatternOp2[_token.name];
    yield Parser.advance();
    return _node(op);
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Braces) {
    yield Parser.advance();
    if (_token.tokens.length === 0) {
      const node = _node(NodeType.RECORD, {
        position: yield* nodePosition(),
        children: [implicitPlaceholder(yield* nodePosition())],
      });
      return node;
    }

    const [exprParseCtx, pattern] = Parser.scope<ValidatedTokenGroup[], Tree>({ isDeepPattern: true }, function* () {
      return yield parsePattern;
    }).parse(_token.tokens, { index: 0 });

    const node = _node(NodeType.RECORD, {
      position: yield* nodePosition(),
    });
    if (pattern.type === NodeType.TUPLE) node.children = pattern.children;
    else node.children.push(pattern);

    if (exprParseCtx.index !== _token.tokens.length) {
      return error(SystemError.invalidPattern(yield* nodePosition()), node);
    }

    return node;
  }

  if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Brackets) {
    yield Parser.advance();
    if (_token.tokens.length === 0)
      return _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
        position: yield* nodePosition(),
        children: [implicitPlaceholder(yield* nodePosition())],
      });

    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });

    if (exprParseCtx.index !== _token.tokens.length) {
      return error(
        SystemError.unknown(),
        _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
          position: yield* nodePosition(),
          children: [expr],
        })
      );
    }

    return _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
      position: yield* nodePosition(),
      children: [expr],
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Parentheses) {
    yield Parser.advance();
    if (_token.tokens.length === 0) {
      return _node(NodeType.PARENS, {
        position: yield* nodePosition(),
        children: [implicitPlaceholder(yield* nodePosition())],
      });
    }

    const [exprParseCtx, pattern] = Parser.scope<ValidatedTokenGroup[], Tree>({ isDeepPattern: true }, function* () {
      return yield parsePattern;
    }).parse(_token.tokens, { index: 0 });

    if (exprParseCtx.index !== _token.tokens.length) {
      return error(
        SystemError.invalidPattern(yield* nodePosition()),
        _node(NodeType.PARENS, { position: yield* nodePosition(), children: [pattern] })
      );
    }

    return _node(NodeType.PARENS, { position: yield* nodePosition(), children: [pattern] });
  }

  if (isDeepPattern && lhs && (yield Parser.identifier("="))) {
    const value: Tree = yield Parser.scope({ lhs: false }, function* () {
      return yield parseExprGroup;
    });
    const node = _node(NodeType.ASSIGN, {
      position: yield* nodePosition(),
      children: [value],
    });
    const precedence = getExprPrecedence(value);
    if (precedence[0] !== null || precedence[1] !== null) {
      return error(SystemError.invalidDefaultPattern(yield* nodePosition()), node);
    }

    return node;
  }

  if (!lhs && (yield Parser.identifier("^"))) {
    const value: Tree = yield Parser.scope({ lhs: false }, function* () {
      return yield parseExprGroup;
    });
    const node = _node(NodeType.PIN, {
      position: yield* nodePosition(),
      children: [value],
    });
    const precedence = getExprPrecedence(value);
    if (precedence[0] !== null || precedence[1] !== null) {
      return error(SystemError.invalidPinPattern(yield* nodePosition()), node);
    }

    return node;
  }

  if (lhs && (yield Parser.identifier("."))) {
    const next: ValidatedTokenGroup | undefined = yield Parser.peek();
    const { followSet }: Context3 = yield Parser.ctx();
    if (!tokenIncludes(next, followSet) && next?.type === "identifier") {
      yield Parser.advance();
      const key = atom(next.name, getTokenPosition(next));
      return _node(NodeType.INDEX, {
        position: yield* nodePosition(),
        children: [key],
      });
    }
    return error(SystemError.invalidIndex(yield* nodePosition()), yield* nodePosition());
  }

  if (lhs) {
    // if function call is with parentheses, make precedence higher than field access
    // so method chaining works as usual
    if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Parentheses) {
      return _node(NodeType.APPLICATION);
    }

    if (isDeepPattern) return _node(NodeType.APPLICATION);
  }

  return yield parseValue;
});

const parseExprGroup: Parser<ValidatedTokenGroup[], Tree, { lhs: boolean }> = Parser.do(function* () {
  const { lhs }: { lhs: boolean } = yield Parser.ctx();
  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: ValidatedTokenGroup[] = yield Parser.src();
    return mapListPosToPos(position(start, index), src.map(getTokenPosition));
  };

  const _token: ValidatedTokenGroup | undefined = yield Parser.peek();

  if (yield Parser.identifier("import")) {
    const nameTokenGroup: ValidatedTokenGroup | undefined = yield Parser.peek();

    if (
      !(
        nameTokenGroup?.type === "group" &&
        "kind" in nameTokenGroup &&
        nameTokenGroup.kind === TokenGroupKind.StringTemplate
      )
    ) {
      return error(SystemError.unknown(), _node(NodeType.IMPORT, { position: yield* nodePosition() }));
    }
    yield Parser.advance();
    if (nameTokenGroup.tokens.length !== 1) {
      return error(SystemError.unknown(), _node(NodeType.IMPORT, { position: yield* nodePosition() }));
    }
    const nameToken = nameTokenGroup.tokens[0];
    if (nameToken.type !== "string") {
      return error(SystemError.unknown(), _node(NodeType.IMPORT, { position: yield* nodePosition() }));
    }
    const name = nameToken.value;
    const pattern: Tree | null = yield Parser.do<ValidatedTokenGroup[], Tree | null, any>(function* () {
      if (yield Parser.identifier("as")) {
        return yield parsePattern;
      }
      return null;
    });

    const node = _node(NodeType.IMPORT, { position: yield* nodePosition() });
    node.data.descriptor = parseImportDescriptor(name);
    if (pattern) node.children.push(pattern);
    inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
    return node;
  }

  if (lhs && (yield Parser.identifier("is"))) {
    const pattern: Tree = yield parsePattern;
    return _node(NodeType.IS, { position: yield* nodePosition(), children: [pattern] });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Record) {
    yield Parser.advance();

    const [entriesParseCtx, children] = Parser.do<ValidatedTokenGroup[], Tree>(function* () {
      const key: Tree = yield Parser.do(function* () {
        const start = yield Parser.index();
        const nodePosition = function* () {
          const index = yield Parser.index();
          const src: ValidatedTokenGroup[] = yield Parser.src();
          return mapListPosToPos(position(start, index), src.map(getTokenPosition));
        };
        const _token: ValidatedTokenGroup | undefined = yield Parser.peek();
        if (!_token) return error(SystemError.unknown(), yield* nodePosition());
        if (_token?.type === "identifier") return yield parseValue;
        if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Brackets) {
          yield Parser.advance();
          const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
          if (exprParseCtx.index !== _token.tokens.length) {
            return error(SystemError.unknown(), expr);
          }
          return _node(NodeType.SQUARE_BRACKETS, { position: yield* nodePosition(), children: [expr] });
        }

        return error(SystemError.unknown(), yield* nodePosition());
      });

      if (key.type !== NodeType.SQUARE_BRACKETS) {
        if ((yield Parser.identifier(",")) || (yield Parser.newline())) return key;
      }
      if (!(yield Parser.identifier(":")))
        return error(
          SystemError.unknown(),
          _node(NodeType.LABEL, { position: yield* nodePosition(), children: [key] })
        );

      const expr = yield Parser.scope<ValidatedTokenGroup[], Tree, any, any>({ followSet: [",", "\n"] }, function* () {
        return yield parseExpr;
      });
      (yield Parser.identifier(",")) || (yield Parser.newline());
      return _node(NodeType.LABEL, { position: yield* nodePosition(), children: [key, expr] });
    })
      .zeroOrMore()
      .parse(_token.tokens, { index: 0 });
    if (entriesParseCtx.index !== _token.tokens.length) {
      return error(SystemError.unknown(), yield* nodePosition());
    }

    return _node(NodeType.RECORD, { position: yield* nodePosition(), children });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Function) {
    return yield Parser.do<ValidatedTokenGroup[], [inner: Tree, typeExpr: Tree | null, expr: Tree | null], any>(
      function* () {
        const _token: ValidatedTokenGroup = yield Parser.next();
        assert(_token?.type === "group");
        const [innerGroup, formToken] = _token.tokens;
        assert(innerGroup.type === "group");
        assert(formToken.type === "group");
        assert("kind" in formToken);

        const inner = yield Parser.do(function* () {
          if (innerGroup.tokens.length === 0) return implicitPlaceholder(indexPosition(yield Parser.index()));

          const [exprParseCtx, expr] = parsePattern.parse(innerGroup.tokens, { index: 0 });

          if (exprParseCtx.index !== innerGroup.tokens.length) {
            return error(SystemError.unknown(), expr);
          }

          return expr;
        });

        return yield Parser.do(function* () {
          if (formToken.kind === TokenGroupKind.Colon) return [inner, null, null];
          if (formToken.kind === TokenGroupKind.Braces) {
            const [exprParseCtx, expr] = parseExpr.parse(formToken.tokens, { index: 0 });
            if (exprParseCtx.index !== formToken.tokens.length) {
              return [inner, null, error(SystemError.unknown(), expr)];
            }
            return [inner, null, expr];
          }

          yield Parser.rememberIndex();
          const typeTokens = yield Parser.do(function* () {
            const typeTokens: ValidatedTokenGroup[] = [];
            while (true) {
              const _token: ValidatedTokenGroup | undefined = yield Parser.peek();
              if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Braces) break;
              if (yield Parser.isEnd()) return null;
              typeTokens.push(yield Parser.next());
            }

            return typeTokens;
          });
          if (typeTokens !== null) {
            const typeExpr = yield Parser.do(function* () {
              const [exprParseCtx, expr] = parseExpr.parse(typeTokens, { index: 0 });
              if (exprParseCtx.index !== typeTokens.length) {
                return error(SystemError.unknown(), expr);
              }
              return expr;
            });
            const blockToken: ValidatedTokenGroup | undefined = yield Parser.next();
            assert(blockToken?.type === "group");
            assert("kind" in blockToken);
            assert(blockToken.kind === TokenGroupKind.Braces);

            const [exprParseCtx, expr] = parseExpr.parse(blockToken.tokens, { index: 0 });
            if (exprParseCtx.index !== blockToken.tokens.length) {
              return [inner, typeExpr, error(SystemError.unknown(), expr)];
            }
            return [inner, typeExpr, expr];
          }
          yield Parser.resetIndex();
          const precedence = _getExprPrecedence(NodeType.SEQUENCE);
          return [inner, null, yield Parser.scope({ precedence: precedence[1]! - 1 }, parsePratt)];
        });
      }
    ).chain(function* ([pattern, typeExpr, expr]) {
      if (!expr) {
        return _node(NodeType.FUNCTION, {
          position: yield* nodePosition(),
          children: [pattern],
          data: { isTopFunction: true },
        });
      }

      const node = _node(NodeType.FUNCTION, {
        position: yield* nodePosition(),
        children: typeExpr ? [pattern, typeExpr, expr] : [pattern, expr],
        data: { isTopFunction: true },
      });
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.If) {
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

        const token2: ValidatedTokenGroup | undefined = yield Parser.peek(1);
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
        inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
        return node;
      });
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.While) {
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
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.ForIn) {
    yield Parser.advance();
    const [patternGroup, exprGroup, formToken] = _token.tokens;
    assert(patternGroup.type === "group");
    assert(exprGroup.type === "group");
    assert(formToken.type === "group");
    assert("kind" in formToken);
    const [patternParseCtx, pattern] = parsePattern.parse(patternGroup.tokens, { index: 0 });
    assert(patternParseCtx.index === patternGroup.tokens.length);
    const [exprParseCtx, expr] = parseExpr.parse(exprGroup.tokens, { index: 0 });
    assert(exprParseCtx.index === exprGroup.tokens.length);

    return yield Parser.do(function* () {
      if (formToken.kind === TokenGroupKind.Colon) return null;
      if (formToken.kind === TokenGroupKind.Braces) {
        const [exprParseCtx, expr] = parseExpr.parse(formToken.tokens, { index: 0 });
        assert(exprParseCtx.index === formToken.tokens.length);
        return expr;
      }
      if (formToken.kind === TokenGroupKind.Arrow) {
        const precedence = _getExprPrecedence(NodeType.SEQUENCE);
        return yield Parser.scope({ precedence: precedence[1]! - 1 }, parsePratt);
      }
    }).chain(function* (body: Tree | null) {
      if (!body) {
        return _node(NodeType.FOR, {
          position: yield* nodePosition(),
          children: [pattern, expr],
        });
      }

      const node = _node(NodeType.FOR, {
        position: yield* nodePosition(),
        children: [pattern, expr, body],
      });
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);

      return node;
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Match) {
    yield Parser.advance();
    const [valueGroup, bodyGroup] = _token.tokens;
    assert(valueGroup.type === "group");
    assert(bodyGroup.type === "group");
    const [valueParseCtx, value] = parseExpr.parse(valueGroup.tokens, { index: 0 });
    assert(valueParseCtx.index === valueGroup.tokens.length);

    const [bodyParseCtx, cases] = Parser.scope<ValidatedTokenGroup[], Tree, any, any>({ followSet: [] }, function* () {
      yield Parser.newline();
      yield Parser.appendFollow("->");
      let pattern: Tree = yield parsePattern;
      yield Parser.popFollow();

      if (!(yield Parser.identifier("->"))) {
        yield Parser.or(yield Parser.identifier(";"), yield Parser.newline()).zeroOrMore();
        return error(SystemError.unknown(), _node(NodeType.MATCH_CASE, { children: [pattern] }));
      }

      yield Parser.appendFollow(";", "\n");
      let body: Tree = yield parseExpr;
      yield Parser.popFollow(2);
      yield Parser.newline();
      yield Parser.identifier(";");

      return _node(NodeType.MATCH_CASE, { children: [pattern, body] });
    })
      .zeroOrMore()
      .parse(bodyGroup.tokens, { index: 0 });

    if (bodyParseCtx.index !== bodyGroup.tokens.length) {
      return error(SystemError.unknown(), _node(NodeType.MATCH, { children: [value, ...cases] }));
    }

    return _node(NodeType.MATCH, { children: [value, ...cases] });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Inject) {
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
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Without) {
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
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Mask) {
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
      inject(Injectable.PrecedenceMap).set(node.id, [null, null]);
      return node;
    });
  }

  if (!lhs) {
    yield Parser.rememberIndex();
    const pattern: Tree = yield parsePattern;
    const next: ValidatedTokenGroup | undefined = yield Parser.peek();
    const { followSet }: Context3 = yield Parser.ctx();

    if (
      next &&
      next.type === "identifier" &&
      !tokenIncludes(next, followSet) &&
      pattern.type !== NodeType.ERROR &&
      Object.hasOwn(idToLhsPatternExprOp, next.name)
    ) {
      const op = idToLhsPatternExprOp[next.name];
      yield Parser.advance();
      return _node(op, { position: yield* nodePosition(), children: [pattern] });
    }

    yield Parser.resetIndex();
  }

  if (!lhs && _token?.type === "identifier" && Object.hasOwn(idToPrefixExprOp, _token.name)) {
    const op = idToPrefixExprOp[_token.name];
    yield Parser.advance();
    return _node(op, { position: yield* nodePosition() });
  }

  if (lhs && _token?.type === "identifier" && Object.hasOwn(idToExprOp, _token.name)) {
    const op = idToExprOp[_token.name];
    yield Parser.advance();
    return _node(op);
  }

  if (!lhs && _token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Braces) {
    yield Parser.advance();
    if (_token.tokens.length === 0) return block(implicitPlaceholder(yield* nodePosition()), yield* nodePosition());

    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return block(expr, yield* nodePosition());
  }

  if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Brackets) {
    yield Parser.advance();
    if (_token.tokens.length === 0)
      return _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
        position: yield* nodePosition(),
        children: [implicitPlaceholder(yield* nodePosition())],
      });

    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return _node(lhs ? NodeType.INDEX : NodeType.SQUARE_BRACKETS, {
      position: yield* nodePosition(),
      children: [expr],
    });
  }

  if (_token?.type === "group" && "kind" in _token && _token.kind === TokenGroupKind.Parentheses) {
    yield Parser.advance();
    const nodeType = lhs ? NodeType.DELIMITED_APPLICATION : NodeType.PARENS;
    if (_token.tokens.length === 0) {
      return _node(nodeType, {
        position: yield* nodePosition(),
        children: [implicitPlaceholder(yield* nodePosition())],
      });
    }

    const [exprParseCtx, expr] = parseExpr.parse(_token.tokens, { index: 0 });
    assert(exprParseCtx.index === _token.tokens.length);

    return _node(nodeType, { position: yield* nodePosition(), children: [expr] });
  }

  if (lhs && (yield Parser.newline())) {
    if (yield Parser.isEnd()) return _node(NodeType.SEQUENCE);

    const _token: ValidatedTokenGroup = yield Parser.peek();
    if (lhs && _token?.type === "identifier" && Object.hasOwn(idToExprOp, _token.name)) {
      const op = idToExprOp[_token.name];
      yield Parser.advance();
      return _node(op);
    }

    if (lhs && (yield Parser.identifier("."))) {
      const next: ValidatedTokenGroup | undefined = yield Parser.peek();
      const { followSet }: Context3 = yield Parser.ctx();
      if (!tokenIncludes(next, followSet) && next?.type === "identifier") {
        yield Parser.advance();
        const key = atom(next.name, getTokenPosition(next));
        return _node(NodeType.INDEX, {
          position: yield* nodePosition(),
          children: [key],
        });
      }
      return error(SystemError.invalidIndex(yield* nodePosition()), yield* nodePosition());
    }

    return _node(NodeType.SEQUENCE);
  }

  if (!lhs && (yield Parser.identifier("|"))) {
    return yield* parsePrattGroup();
  }

  if (lhs && (yield Parser.identifier("."))) {
    const next: ValidatedTokenGroup | undefined = yield Parser.peek();
    const { followSet }: Context3 = yield Parser.ctx();
    if (!tokenIncludes(next, followSet) && next?.type === "identifier") {
      yield Parser.advance();
      const key = atom(next.name, getTokenPosition(next));
      return _node(NodeType.INDEX, {
        position: yield* nodePosition(),
        children: [key],
      });
    }
    return error(SystemError.invalidIndex(yield* nodePosition()), yield* nodePosition());
  }

  if (lhs) {
    return _node(NodeType.APPLICATION);
  }

  if (!lhs && _token?.type === "identifier" && Object.hasOwn(idToExprOp, _token.name)) {
    yield Parser.advance();
    const name = _token.name;
    const op = idToExprOp[name];
    const position = yield* nodePosition();
    const node = error(
      SystemError.infixOperatorInPrefixPosition(name, op, position),
      _node(op, { position, children: [implicitPlaceholder(position)] })
    );
    const precedence = _getExprPrecedence(op);
    inject(Injectable.PrecedenceMap).set(node.id, [null, precedence[1]]);
    return node;
  }

  return yield parseValue;
});

const parsePrattGroup = function* (): ParserGenerator<ValidatedTokenGroup[], any, Tree, Context3> {
  const { groupParser, followSet }: Context3 = yield Parser.ctx();
  const start = yield Parser.index();
  const nodePosition = function* (): ParserGenerator<ValidatedTokenGroup[], any, Position, Context3> {
    const index = yield Parser.index();
    const src: ValidatedTokenGroup[] = yield Parser.src();
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

const parsePrefix: Parser<ValidatedTokenGroup[], Tree, Context3> = Parser.do(function* self() {
  yield Parser.newline();

  const start = yield Parser.index();
  const nodePosition = function* () {
    const index = yield Parser.index();
    const src: ValidatedTokenGroup[] = yield Parser.src();
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

  const rhs: Tree = yield Parser.scope({ precedence: right }, parsePratt) as any;

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
    yield Parser.rememberIndex();
    const opGroup: Tree = yield Parser.scope({ lhs: true }, parsePrattGroup as any);
    const [left, right] = getPrecedence(opGroup);

    if (left === null) {
      yield Parser.resetIndex();
      break;
    }
    if (left <= precedence) {
      yield Parser.resetIndex();
      break;
    }

    if (right === null) {
      lhs = postfix(opGroup, lhs);
      continue;
    }

    if (opGroup.type === NodeType.SEQUENCE) {
      yield Parser.newline();
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

const parseExpr = Parser.do<ValidatedTokenGroup[], Tree>(function* () {
  const { followSet = [] }: Context3 = yield Parser.ctx();
  return yield Parser.scope<ValidatedTokenGroup[], Tree>(
    { groupParser: parseExprGroup, getPrecedence: getExprPrecedence, precedence: 0, followSet },
    parsePratt
  );
});

const parsePattern = Parser.do(function* () {
  const { followSet = [], isDeepPattern = false }: Context3 & { isDeepPattern: boolean } = yield Parser.ctx();
  return yield Parser.scope<ValidatedTokenGroup[], Tree, {}, Context3 & { isDeepPattern: boolean }>(
    {
      isDeepPattern,
      groupParser: parsePatternGroup,
      getPrecedence: getPatternPrecedence,
      precedence: 0,
      followSet,
    },
    parsePratt
  );
});

export const parseScript = (src: ValidatedTokenGroup[]) =>
  Parser.do(function* () {
    if (src.length === 0) return script([]);

    const expr = yield parseExpr;
    if (expr.type === NodeType.SEQUENCE) return script(expr.children);
    return script([expr]);
  }).parse(src, { index: 0 })[1];

const parseDeclaration = Parser.scope<ValidatedTokenGroup[], Tree, any, any>({ followSet: [";", "\n"] }, function* () {
  return yield parseExpr;
});

// const parseDeclaration: ParserFunction<TokenGroup[], Tree> = (src, i) => {
//   const context = newContext({ banned: [";"] });
//   return parseExpr(context)(src, i);
// };

export const parseModule = (src: ValidatedTokenGroup[]) =>
  Parser.do(function* () {
    const children: Tree[] = [];
    let lastExport: Tree | null = null;

    while (yield Parser.isNotEnd()) {
      yield Parser.newline();
      yield Parser.identifier(";");
      const node: Tree = yield parseDeclaration;
      if (node.type !== NodeType.EXPORT) {
        children.push(node);
        continue;
      }
      if (node.children[0].type === NodeType.DECLARE) {
        children.push(node);
        continue;
      }
      if (lastExport) {
        const errorNode = error(SystemError.duplicateDefaultExport(getPosition(lastExport)), lastExport);
        children.push(errorNode);
      }
      lastExport = node;
    }

    if (lastExport) children.push(lastExport);
    return module(children.flatMap((node) => (node.type === "sequence" ? node.children : [node])));
  }).parse(src, { index: 0 })[1];
