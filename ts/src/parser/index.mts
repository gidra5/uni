import { ok, err, Result, unwrapOk } from "../types.mjs";
import { assert } from "../utils.mjs";
import { Parser, KEYWORDS, Keyword, isLiteral, RegistryKey, OperatorSeparator, OperatorRegistry, Operator, isOperator, ParserRecovery, Token, Expression , Error} from "./types.mjs";
import {
  ParsingHandler, transpose, compareOperators
} from "./utils.mjs";


export const IDENTIFIER_SYMBOL_REGEXP = /[_a-zA-Z0-9]/;
export const OPERATOR_SYMBOL_REGEXP = /[~|^\(\)\{\}\[\]<-@/\-+*#-&!\.]/;


const parseMultilineComment = <U,>(parser: ParsingHandler<string, U>) => {
  while (parser.peek() && !(parser.peek() === "*" && parser.peek(1) === "/")) {
    if (parser.peek() === "/" && parser.peek(1) === "*") {
      parser.advance(2);
      parseMultilineComment(parser);
    }
    parser.advance();
  }
  parser.advance(2);
};

export const parseToken: Parser<string, Token, Error> = (parser) => {
  if (parser.peek() === ":" && parser.peek(1) === "=") {
    parser.advance(2);
    return ok({ type: "ident", item: ":=" });
  }
  if (parser.skip([":"])) return ok(":");
  if (parser.skip([";"])) return ok(";");

  if (parser.peek() === "\n") {
    parser.skipAll([" ", "\t", "\r", "\n"]);
    return ok("\n");
  }

  // whitespace characters
  if (parser.peek()?.match(/\s/)) {
    parser.advance();
    return err(Error.SKIP);
  }

  // comments
  if (parser.peek() === "/" && parser.peek(1) === "/") {
    while (parser.peek() && parser.peek() !== "\n") parser.advance();
    parser.advance();
    return err(Error.SKIP);
  }

  // nested multiline comments
  if (parser.peek() === "/" && parser.peek(1) === "*") {
    parser.advance(2);
    parseMultilineComment(parser);
    return err(Error.SKIP);
  }

  // number
  if (parser.peek()?.match(/[0-9]/)) {
    let src = parser.next()!;

    while (parser.peek()?.match(/[0-9]/)) src += parser.next()!;
    if (parser.peek() === ".") {
      src += parser.next()!;
      while (parser.peek()?.match(/[0-9]/)) src += parser.next()!;
    }

    return ok({ type: "number", item: Number(src) });
  }

  // fractional number
  if (parser.peek() === "." && parser.peek(1)?.match(/[0-9]/)) {
    parser.advance();
    let src = "0." + parser.next();
    while (parser.peek()?.match(/[0-9]/)) src += parser.next();
    return ok({ type: "number", item: Number(src) });
  }

  // char
  if (parser.skip(["'"])) {
    let char = parser.next();
    if (char === "\\") char = parser.next();

    if (!char) return err(Error.UNEXPECTED_END);
    if (!parser.skip(["'"])) return err(Error.MISSING_CLOSING_APOSTROPHE);
    return ok({ type: "char", item: char });
  }

  // string
  if (parser.skip(['"'])) {
    let src = "";
    while (!parser.skip(['"'])) {
      if (!parser.peek()) return err(Error.MISSING_CLOSING_APOSTROPHE);

      let char = parser.next();
      if (char === "\\") char = parser.next();

      if (!char) return err(Error.UNEXPECTED_END);
      src += char;
    }
    return ok({ type: "string", item: src });
  }

  // multiline strings
  if (parser.peek() === "\\" && parser.peek(1) === "\\") {
    parser.advance(2);
    let src = "";
    while (parser.peek() && parser.peek() !== "\n") src += parser.next();
    parser.advance();
    return ok({ type: "multilineString", item: src });
  }

  // identifier
  if (parser.peek()?.match(IDENTIFIER_SYMBOL_REGEXP)) {
    let src = parser.next()!;
    while (parser.peek()?.match(IDENTIFIER_SYMBOL_REGEXP)) src += parser.next()!;

    if (KEYWORDS.includes(src as Keyword)) return ok(src as Keyword);
    if (['true', 'false'].includes(src)) return ok({ type: 'boolean', item: src as 'true' | 'false'})
    return ok({ type: "ident", item: src });
  }
  if (parser.peek()?.match(OPERATOR_SYMBOL_REGEXP)) {
    let src = parser.next()!;
    while (parser.peek()?.match(OPERATOR_SYMBOL_REGEXP)) src += parser.next()!;
    return ok({ type: "ident", item: src });
  }

  return err(Error.UNRECOGNIZED_INPUT);
};

export const tokenize = (source: string) => {
  const parser = new ParsingHandler<string, Token>([...source]);
  return [
    ...(function* (): Generator<Result<Token, Error>, void, unknown> {
      let str: string | null = null;
      for (const resToken of parser.parse(parseToken)) {
        if (resToken.type === "err") yield resToken;
        const token = unwrapOk(resToken);
        if (isLiteral(token) && token.type === "multilineString") {
          if (!str) str = token.item;
          else str += "\n" + token.item;
        } else {
          if (str) {
            yield ok({ type: "multilineString", item: str });
            str = null;
          }
          yield resToken;
        }
      }
    })(),
  ];
  // const info = [...parser.parse(parseToken)].reduce(
  //   (acc, { item, ...rest }) => {
  //     if (item.type === "ok") {
  //       acc[0].push(item.value);
  //       acc[1].push(rest);
  //     } else acc[2].push({ item: item.err, ...rest });
  //     return acc;
  //   },
  //   [
  //     [],
  //     [],
  //     [],
  //   ] as [Token[], Span[], (Span & { item: Error })[]]
  // );
  // return info;
};

type OperatorError =
  | Error
  | {
      operator: RegistryKey;
      separator: OperatorSeparator;
      error: OperatorError[];
    };


export const parseOperator =
  (operatorRegistry: OperatorRegistry): Parser<Operator, Operator, OperatorError[]> =>
  (parser) => {
    const peeked = parser.peek();
    if (!peeked) return err([Error.UNEXPECTED_END]);
    parser.advance();

    if (isOperator(peeked)) {
      const [operands, errors] = peeked.operands
        .map((repetition) =>
          repetition
            .map((operand) => {
              const _parser = new ParsingHandler<Operator, Operator>(operand);
              const res = [..._parser.parse(parseOperator(operatorRegistry), operatorRecovery)];
              return transpose(res);
            })
            .reduce(
              (acc, [item, errors]) => {
                acc[1].push(...errors);
                acc[0].push(item);
                return acc;
              },
              [[] as Operator[][], [] as OperatorError[]] as const
            )
        )
        .reduce(
          (acc, [item, errors]) => {
            acc[1].push(...errors);
            acc[0].push(item);
            return acc;
          },
          [[] as Operator[][][], [] as OperatorError[]] as const
        );
      if (errors.length > 0) return err(errors);

      const operator = peeked.operator;
      return ok({ type: "operator", operator, operands });
    }

    if (!(typeof peeked === "object" && peeked.type === "ident")) return ok(peeked);

    const errors = [] as OperatorError[];

    _operators: for (const [
      operator,
      {
        separators: [leadingSeparator, ...separators],
        keepNewLine,
      },
    ] of operatorRegistry.entries()) {
      if (leadingSeparator.ident === peeked.item) {
        const operands: Operator[][][] = [];
        let prevSeparator: OperatorSeparator = leadingSeparator;

        for (const separator of separators) {
          const repOperands: Operator[][] = [];
          if (!separator.optional) {
            const sepOperands: Operator[] = [];
            while (parser.peek()) {
              if (parser.peek() === "\n" && !keepNewLine) continue;
              const nextOperator = parseOperator(operatorRegistry)(parser);

              if (nextOperator.type === "err") {
                errors.push({ operator, separator, error: nextOperator.err });
                parser.reset();
                continue _operators;
              }
              const { value } = nextOperator;
              const cmp = (separator: OperatorSeparator) => {
                const isIdent = typeof value === "object" && value.type === "ident";
                const isToken = typeof value === "string";
                const [token1, token2] =
                  isIdent && "ident" in separator
                    ? [value.item, separator.ident]
                    : isToken && "token" in separator
                    ? [value, separator.token]
                    : [];
                assert(token1 && token2, "wtf");

                return typeof token2 === "string" ? token1 === token2 : token2.includes(token1);
              };
              if (cmp(separator)) {
                operands.push(repOperands);
                operands.push([sepOperands]);
                break;
              }
              if (((prevSeparator.optional && repOperands.length < 1) || prevSeparator.repeat) && cmp(prevSeparator)) {
                repOperands.push(sepOperands);
                continue;
              }

              sepOperands.push(value);
            }
          }
          prevSeparator = separator;
        }
        return ok({ type: "operator", operands, operator });
      }
    }
    // return err([...errors, Error.UNRECOGNIZED_OPERATOR]);
    return ok(peeked);
  };

export const operatorRecovery: ParserRecovery<Operator, Operator, OperatorError[]> = (parser, error) =>
  Error.UNRECOGNIZED_OPERATOR;

export const operands = (operatorRegistry: OperatorRegistry) => (source: string) => {
  const [tokens] = transpose(tokenize(source));
  const parser = new ParsingHandler<Token, Operator>([...tokens]);

  return [...parser.parse(parseOperator(operatorRegistry), operatorRecovery)];
  // const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator(operatorRegistry), operatorRecovery)].reduce(
  //   (acc, { item, ...rest }) => {
  //     if (item.type === "ok") {
  //       acc[0].push(item.value);
  //       acc[1].push(rest);
  //     } else acc[2].push({ item: item.err, ...rest });
  //     return acc;
  //   },
  //   [
  //     [],
  //     [],
  //     [],
  //   ] as [Operator[], Span[], (Span & { item: Error })[]]
  // );
  // return [operators, tokenSpans, spans, operatorErrors, errors];
};

export const parseExpr =
  ({
    operatorRegistry,
    minPrecedenceOperator,
    nodes = [],
  }: {
    operatorRegistry: OperatorRegistry;
    minPrecedenceOperator?: Operator;
    nodes?: Expression[];
  }): Parser<Operator, Expression, Error> =>
  (parser) => {
    let lhs: Expression | undefined = parser.next();
    if (!lhs) return err(Error.UNEXPECTED_END);

    if (typeof lhs === "object" && lhs.type === "ident") {
      const id = lhs.item.match(/$_(\d*)_^/);

      if (id) {
        const [, _index] = id;
        if (!_index) {
          const node = nodes.shift();
          if (!node) return err(Error.UNEXPECTED_END);
          lhs = node;
        } else {
          const index = Number(_index) - 1;
          lhs = nodes[index];
        }
      }
    }

    // if found prefix operator
    if (
      isOperator(lhs) &&
      operatorRegistry.get(lhs.operator).precedence[0].type === "none" &&
      operatorRegistry.get(lhs.operator).precedence[1].type === "some"
    ) {
      const rhs = parseExpr({
        operatorRegistry,
        minPrecedenceOperator: lhs,
        nodes,
      })(parser);
      if (rhs.type == "err") return rhs;

      lhs = { type: "prefix", item: { operator: lhs, right: rhs.value } };
    }

    const comparator = compareOperators(operatorRegistry);

    while (comparator(minPrecedenceOperator, parser.peek())) {
      const next = parser.next();
      if (!next) return err(Error.UNEXPECTED_END);

      // if found postfix operator
      if (
        isOperator(next) &&
        operatorRegistry.get(next.operator).precedence[1].type === "none" &&
        operatorRegistry.get(next.operator).precedence[0].type === "some"
      ) {
        lhs = { type: "postfix", item: { left: lhs, operator: next } };
        continue;
      }

      const rhs = parseExpr({
        operatorRegistry,
        minPrecedenceOperator: next,
        nodes,
      })(parser);
      if (rhs.type == "err") return err(rhs.err);

      lhs = {
        type: "infix",
        item: { left: lhs, operator: next, right: rhs.value },
      };
    }

    return ok(lhs);
  };

export const expr = (operatorRegistry: OperatorRegistry, nodes?: Expression[]) => (source: string) => {
  const [_operands] = transpose(operands(operatorRegistry)(source));
  const __operands = [..._operands];
  console.dir({ operatorRegistry, __operands }, { depth: 8 });

  // const exprParser = new ParsingHandler<Operator, Expression>([..._operands]);
  const exprParser = new ParsingHandler<Operator, Expression>(__operands);

  return [...exprParser.parse(parseExpr({ operatorRegistry, nodes }))];
  // const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator(operatorRegistry), operatorRecovery)].reduce(
  //   (acc, { item, ...rest }) => {
  //     if (item.type === "ok") {
  //       acc[0].push(item.value);
  //       acc[1].push(rest);
  //     } else acc[2].push({ item: item.err, ...rest });
  //     return acc;
  //   },
  //   [
  //     [],
  //     [],
  //     [],
  //   ] as [Operator[], Span[], (Span & { item: Error })[]]
  // );
  // return [operators, tokenSpans, spans, operatorErrors, errors];
};
