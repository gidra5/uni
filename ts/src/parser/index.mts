import { ok, err, Result, unwrapOk } from "../types.mjs";
import { repeat } from "../utils.mjs";
import {
  KEYWORDS,
  Keyword,
  isLiteral,
  OperatorSeparator,
  OperatorRegistry,
  Operator,
  isOperator,
  Token,
  Expression,
  Error,
  isIdentifier,
} from "./types.mjs";
import { transpose, compareOperators, DEFAULT_PRECEDENCE } from "./utils.mjs";

export const IDENTIFIER_SYMBOL_REGEXP = /[_a-zA-Z0-9]/;
export const OPERATOR_SYMBOL_REGEXP = /[~|^\(\)\{\}\[\]<-@/\-+*#-&!\.]/;

export class ParsingHandler<T> {
  private resetIndex: number;
  private index: number;
  constructor(
    private src: T[],
    options?: {
      index?: number;
      resetIndex?: number;
    }
  ) {
    this.index = options?.index ?? 0;
    this.resetIndex = options?.resetIndex ?? this.index;
  }

  skip<A extends T[]>(values: A) {
    const isNext = this.peekIs(values);
    if (isNext) this.advance();
    return isNext;
  }
  skipAll<A extends T[]>(values: A) {
    while (this.skip(values)) {}
  }

  peekIs<A extends T[]>(values: A) {
    return values.includes(this.peek() as T);
  }

  peek(step = 0): T | undefined {
    return this.src[this.index + step];
  }

  next(step = 1): T | undefined {
    const item = this.src[this.index];
    this.advance(step);
    return item;
  }

  advance(step = 1) {
    this.index += step;
  }

  setIndex() {
    this.resetIndex = this.index;
  }

  reset() {
    this.index = this.resetIndex;
  }
}

const parseMultilineComment = <U>(parser: ParsingHandler<string, U>) => {
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
    while (parser.peek()?.match(IDENTIFIER_SYMBOL_REGEXP))
      src += parser.next()!;

    if (KEYWORDS.includes(src as Keyword)) return ok(src as Keyword);
    if (["true", "false"].includes(src))
      return ok({ type: "boolean", item: src as "true" | "false" });
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

const operatorEq = (token1: Operator, token2: Operator) => {
  if (typeof token1 === "string" || typeof token2 === "string")
    return token1 === token2;

  return token1.type === token2.type && token1.item === token2.item;
};
const operatorEqCurried = (token1: Operator) => (token2: Operator) =>
  operatorEq(token1, token2);
const separatorEq =
  (value: Operator) =>
  ({ token }: OperatorSeparator) =>
    Array.isArray(token)
      ? token.some(operatorEqCurried(value))
      : operatorEq(value, token);

export const parseOperator =
  (operatorRegistry: OperatorRegistry): Parser<Operator, Operator, Error> =>
  (parser): Result<Operator, Error> => {
    const peeked = parser.peek();
    if (!peeked) return err(Error.UNEXPECTED_END);
    parser.advance();

    if (isOperator(peeked)) {
      const [operands, errors] = peeked.operands
        .map((repetition) =>
          repetition
            .map((operand) => {
              const _parser = new ParsingHandler<Operator, Operator>(operand);
              const res = [..._parser.parse(parseOperator(operatorRegistry))];
              return transpose(res);
            })
            .reduce(
              (acc, [item, errors]) => {
                acc[1].push(...errors);
                acc[0].push(item);
                return acc;
              },
              [[] as Operator[][], [] as Error[]] as const
            )
        )
        .reduce(
          (acc, [item, errors]) => {
            acc[1].push(...errors);
            acc[0].push(item);
            return acc;
          },
          [[] as Operator[][][], [] as Error[]] as const
        );
      if (errors.length > 0) return err(errors[0]);

      const operator = peeked.item;
      return ok({ type: "operator", item: operator, operands });
    }

    if (!isIdentifier(peeked)) return ok(peeked);

    const errors = [] as Error[];

    _operators: for (const [
      operator,
      { separators: _sep, keepNewLine },
    ] of operatorRegistry.entries()) {
      // if current token doesnt match leading separator, then next tokens are other operator's operands
      if (!separatorEq(peeked)(_sep[0])) continue;
      let [, ...separators] = _sep;

      const operands: Operator[][][] = [];
      const repOperands: Operator[][] = [];
      const sepOperands: Operator[] = [];

      while (parser.peek()) {
        if (parser.peek() === "\n" && !keepNewLine) continue;
        const nextOperator = parseOperator(operatorRegistry)(parser);

        if (nextOperator.type === "err") {
          errors.push(nextOperator.err);
          parser.reset();
          continue _operators;
        }

        const { value } = nextOperator;
        const cmp = separatorEq(value);

        // for current operator check if its one of repeated operators
        const repeatedSeparatorIndex = separators.findIndex(cmp);

        // if found one then all separators before it were skipped, we can drop them from list
        if (repeatedSeparatorIndex !== -1) {
          const repeating = separators[repeatedSeparatorIndex].repeat;
          const optional = separators[repeatedSeparatorIndex].optional;

          // if separator is not repeating - slice index should cover current separator
          const index = !repeating
            ? repeatedSeparatorIndex + 1
            : repeatedSeparatorIndex;

          // remove preceding separators, since they were skipped and push empty arrays as their operands
          separators = separators.slice(index);
          operands.push(...repeat([], repeatedSeparatorIndex));

          if (repeating || (optional && repOperands.length === 0))
            repOperands.push(sepOperands);
          if (!repeating && !optional) operands.push([sepOperands]);
          else operands.push(repOperands);
        } else if (separators.length !== 0) sepOperands.push(value);
        else break;
      }

      if (separators.every(({ optional }) => optional))
        return ok({ type: "operator", operands, item: operator });
    }

    // return err([...errors, Error.UNRECOGNIZED_OPERATOR]);
    return ok(peeked);
  };

export const operatorRecovery: ParserRecovery<Operator, Operator, Error> = () =>
  Error.UNRECOGNIZED_OPERATOR;

export const operands =
  (operatorRegistry: OperatorRegistry) => (source: string) => {
    const [tokens] = transpose(tokenize(source));
    const parser = new ParsingHandler<Token, Operator>([...tokens]);

    return [...parser.parse(parseOperator(operatorRegistry))];
    // const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator(operatorRegistry))].reduce(
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
    if (isOperator(lhs)) {
      const precedence =
        operatorRegistry.get(lhs.item).precedence ?? DEFAULT_PRECEDENCE;
      if (precedence[1].type === "none" && precedence[0].type === "some") {
        const rhs = parseExpr({
          operatorRegistry,
          minPrecedenceOperator: lhs,
          nodes,
        })(parser);
        if (rhs.type == "err") return rhs;

        lhs = { type: "prefix", item: { operator: lhs, right: rhs.value } };
      }
    }

    const comparator = compareOperators(operatorRegistry);

    while (comparator(minPrecedenceOperator, parser.peek())) {
      const next = parser.next();
      if (!next) return err(Error.UNEXPECTED_END);

      // if found postfix operator
      if (isOperator(next)) {
        const precedence =
          operatorRegistry.get(next.item).precedence ?? DEFAULT_PRECEDENCE;
        if (precedence[1].type === "none" && precedence[0].type === "some") {
          lhs = { type: "postfix", item: { left: lhs, operator: next } };
          continue;
        }
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

export const expr =
  (operatorRegistry: OperatorRegistry, nodes?: Expression[]) =>
  (source: string) => {
    const [_operands] = transpose(operands(operatorRegistry)(source));
    const __operands = [..._operands];
    console.dir({ operatorRegistry, __operands }, { depth: 8 });

    // const exprParser = new ParsingHandler<Operator, Expression>([..._operands]);
    const exprParser = new ParsingHandler<Operator, Expression>(__operands);

    return [...exprParser.parse(parseExpr({ operatorRegistry, nodes }))];
    // const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator(operatorRegistry))].reduce(
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
