import {
  TaggedItemUnion,
  Option,
  TaggedUnion,
  Result,
  ok,
  err,
} from "./types.mjs";

export type Span = { start: number; end: number };
export type FileSpan = Span & { index: number };
export class Registry<T> {
  constructor(private registry: T[] = [], private nextIndex: number = 0) {}

  entries() {
    return this.registry.map((item, i) => [item, i] as const);
  }
  get(index: number) {
    return this.registry[index];
  }
  register(item: T) {
    const index = this.nextIndex++;
    this.registry[index] = item;
    return index;
  }
}

export type Literal = TaggedItemUnion<{
  ident: string;
  string: string;
  char: string;
  number: number;
}>;
export const IDENTIFIER_SYMBOL_REGEXP = /[_a-zA-Z0-9]/;
export const OPERATOR_SYMBOL_REGEXP = /[~|^\(\)\{\}\[\]<-@/\-+*#-&!]/;
export const KEYWORDS = [
  "for",
  "in",
  "if",
  "is",
  "as",
  "_",
  "true",
  "false",
  "fn",
] as const;
export type Keyword = typeof KEYWORDS[number];
export type Token = Keyword | Literal | "\n" | "," | "." | "..." | ":" | ";";
export type Precedence = [Option<number>, Option<number>];
export type OperatorSeparator = { ident: string; optional?: boolean };
export type OperatorDefinition = {
  separators: OperatorSeparator[];
  precedence: Precedence;
};
export type OperatorRegistry = Registry<OperatorDefinition>;

export type Operator =
  | { type: "operator"; operands: Operator[][]; /* id */ operator: number }
  | Token;
export type Expression =
  | TaggedItemUnion<{
      prefix: { operator: Expression; right: Expression };
      postfix: { operator: Expression; left: Expression };
      infix: { operator: Expression; left: Expression; right: Expression };
      mixfix: { operator: number; operands: Expression[] };

      block: { items: Expression[] };
      record: {
        key?: TaggedUnion<{
          name: { name: string };
          value: { value: Expression };
          rest: {};
        }>;
        value: Expression;
      }[];
    }>
  | Token;
export type Pattern = TaggedItemUnion<{
  bind: string;
  value: Literal;
  record: {
    key?: TaggedUnion<{
      name: { name: string };
      value: { value: Pattern };
      rest: {};
    }>;
    value: Pattern;
  }[];
}> & { defaultValue?: Expression; alias?: string };

export type ModuleRegistry = Registry<ModuleItem[]>;
export type ModuleItem = TaggedItemUnion<{
  import: { module: number; pattern?: Pattern };
  declaration: { name: string; value: Expression };
}> & { public?: boolean };
export type Script = (Expression | ModuleItem)[];

export enum Error {
  UNEXPECTED_END,
  UNRECOGNIZED_INPUT,
  MISSING_CLOSING_APOSTROPHE,
  SKIP,
}

export type Parser<T, U, E> = (state: ParsingHandler<T, U>) => Result<U, E>;
export type ParserRecovery<T, U, E> = (
  state: ParsingHandler<T, U>,
  error: E
) => Error;

export type ParsingContext = { operators: OperatorRegistry };

export class ParsingHandler<T, U> {
  private resetIndex: number;
  private index: number;
  context: ParsingContext;
  constructor(
    private src: T[],
    options?: {
      index?: number;
      resetIndex?: number;
      context?: ParsingContext;
    }
  ) {
    this.index = options?.index ?? 0;
    this.resetIndex = options?.resetIndex ?? this.index;
    this.context = options?.context ?? { operators: new Registry() };
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

  *parse<E>(
    ...args:
      | [handler: Parser<T, U, Error>]
      | [handler: Parser<T, U, E>, recover: ParserRecovery<T, U, E>]
  ) {
    const [handler, recover] = args;
    while (this.peek()) {
      const start = this.index;
      const item = handler(this);

      if (item.type === "err") {
        let error = item.err;

        if (recover) {
          error = recover(this, item.err as E);
          this.setIndex();
        }

        if (error === Error.SKIP) continue;
        yield { start, end: this.index, item: err<U, Error>(error as Error) };
      } else {
        this.setIndex();
        yield { start, end: this.index, item: ok<U, Error>(item.value) };
      }
    }
  }
}

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
    while (parser.peek()?.match(/\s/)) parser.advance();
    return err(Error.SKIP);
  }

  // comments
  if (parser.peek() === "/" && parser.peek(1) === "/") {
    while (parser.peek() && parser.peek() !== "\n") parser.advance();
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

  if (parser.skip(["."])) {
    // fractional number
    if (parser.peek()?.match(/[0-9]/)) {
      let src = "0." + parser.next();
      while (parser.peek()?.match(/[0-9]/)) src += parser.next();
      return ok({ type: "number", item: Number(src) });
    }

    // ellipsis
    if (parser.peek() === "." && parser.peek(1) === ".") {
      parser.advance(2);
      return ok("...");
    }

    // period
    return ok(".");
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

  // identifier
  if (parser.peek()?.match(IDENTIFIER_SYMBOL_REGEXP)) {
    let src = parser.next()!;
    while (parser.peek()?.match(IDENTIFIER_SYMBOL_REGEXP))
      src += parser.next()!;

    if (KEYWORDS.includes(src as Keyword)) return ok(src as Keyword);
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
  const info = [...parser.parse(parseToken)].reduce(
    (acc, { item, ...rest }) => {
      if (item.type === "ok") {
        acc[0].push(item.value);
        acc[1].push(rest);
      } else acc[2].push({ item: item.err, ...rest });
      return acc;
    },
    [
      [],
      [],
      [],
    ] as [Token[], Span[], (Span & { item: Error })[]]
  );
  return info;
};

type OperatorError =
  | Error
  | { operator: number; separator: OperatorSeparator; error: OperatorError[] };

export const parseOperator: Parser<Token, Operator, OperatorError[]> = (
  parser
) => {
  const peeked = parser.peek();
  if (!peeked) return err([Error.UNEXPECTED_END]);
  if (!(typeof peeked === "object" && peeked.type === "ident")) {
    parser.advance();
    return ok(peeked);
  }
  const errors = [] as OperatorError[];

  _operators: for (const [
    { separators: [leadingSeparator, ...separators] },
    operator,
  ] of parser.context.operators.entries()) {
    const operands: Operator[][] = [];
    if (leadingSeparator.ident === peeked.item) {
      for (const separator of separators) {
        operands.push([]);

        while (true) {
          const nextOperator = parseOperator(parser);

          if (nextOperator.type === "err") {
            errors.push({ operator, separator, error: nextOperator.err });
            parser.reset();
            continue _operators;
          }
          const { value } = nextOperator;

          if (!(typeof value === "object" && value.type === "ident")) {
            operands[operands.length - 1] = [
              ...operands[operands.length - 1],
              value,
            ];
            continue;
          }
          if (value.item === separator.ident) {
            parser.advance();
            break;
          }
        }
      }
      return ok({ type: "operator", operands, operator });
    }
  }
  return err(errors);
};

export const operands = (source: string) => {
  const [tokens, spans, errors] = tokenize(source);
  const parser = new ParsingHandler<Token, Operator>([...tokens]);
  const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator, () => Error.UNEXPECTED_END)].reduce(
    (acc, { item, ...rest }) => {
      if (item.type === "ok") {
        acc[0].push(item.value);
        acc[1].push(rest);
      } else acc[2].push({ item: item.err, ...rest });
      return acc;
    },
    [
      [],
      [],
      [],
    ] as [Operator[], Span[], (Span & { item: Error })[]]
  );
  return [operators, tokenSpans, spans, operatorErrors, errors];
};