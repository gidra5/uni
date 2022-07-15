import {
  TaggedItemUnion,
  Option,
  TaggedUnion,
  Result,
  ok,
  err,
  none,
  some,
} from "./types.mjs";
import crypto from 'crypto';

export type Span = { start: number; end: number };
export type FileSpan = Span & { index: number };
export type RegistryKey = string;
export class Registry<T> {
  constructor(private registry: { [k in RegistryKey]: T } = {}) {}

  entries() {
    return Object.entries(this.registry);
  }
  get(index: RegistryKey) {
    return this.registry[index];
  }
  register(item: T) {
    const key = crypto.randomUUID().slice(0, 8);
    this.registry[key] = item;
    return key;
  }
}

export type Literal = TaggedItemUnion<{
  ident: string;
  string: string;
  multilineString: string;
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
export const MAX_PRECEDENCE = 256;
export type OperatorSeparator = { ident: string; optional?: boolean };
export type OperatorDefinition = {
  separators: OperatorSeparator[];
  precedence: Precedence;
  skipNewLine?: boolean;
};
export type OperatorRegistry = Registry<OperatorDefinition>;

export type Operator =
  | { type: "operator"; operands: Operator[][]; /* id */ operator: RegistryKey }
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
  | Operator;
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
  UNRECOGNIZED_OPERATOR,
  MISSING_CLOSING_APOSTROPHE,
  SKIP,
}

export type Parser<T, U, E> = (state: ParsingHandler<T, U>) => Result<U, E>;
export type ParserRecovery<T, U, E> = (
  state: ParsingHandler<T, U>,
  error: E
) => Error;

export type ParsingContext = { operators: OperatorRegistry, };

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

  // multiline strings
  if (parser.peek() === "\\" && parser.peek(1) === "\\") {
    parser.advance(2);
    let src = "";
    while (parser.peek() && parser.peek() !== "\n") src += parser.next();
    parser.advance();
    return ok({ type: 'multilineString', item: src });
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
  | { operator: RegistryKey; separator: OperatorSeparator; error: OperatorError[] };

export const parseOperator: Parser<Token, Operator, OperatorError[]> = (
  parser
) => {
  const peeked = parser.peek();
  
  if (!peeked) return err([Error.UNEXPECTED_END]);
  parser.advance();

  if (!(typeof peeked === "object" && peeked.type === "ident"))
    return ok(peeked);
  
  const errors = [] as OperatorError[];

  _operators: for (const [
    operator,
    { separators: [leadingSeparator, ...separators], skipNewLine },
  ] of parser.context.operators.entries()) {
    const operands: Operator[][] = [];
    if (leadingSeparator.ident === peeked.item) {
      for (const separator of separators) {
        operands.push([]);

        while (parser.peek()) {
          if (parser.peek() === '\n' && skipNewLine) continue;
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
  // return err([...errors, Error.UNRECOGNIZED_OPERATOR]);
  return ok(peeked);
};

export const operands = (source: string, operatorRegistry: OperatorRegistry) => {
  const [tokens, spans, errors] = tokenize(source);
  const parser = new ParsingHandler<Token, Operator>([...tokens], { context: {operators:operatorRegistry}});
  const [operators, tokenSpans, operatorErrors] = [...parser.parse(parseOperator, (parser, error) => Error.UNRECOGNIZED_OPERATOR)].reduce(
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

/**
 * 
 * @param operatorRegistry 
 * @returns left is `less`\\`greater`\\`equal` to right, or can't be compared
 */
export const compareOperators = (operatorRegistry: OperatorRegistry) => (left?: Operator, right?: Operator): Option<'less' | 'greater' | 'equal'> => {
  if (typeof left !== 'object' || left.type !== 'operator') return none();
  if (typeof right !== 'object' || right.type !== 'operator') return none();
  const [, _leftBP] = operatorRegistry.get(left.operator).precedence;
  const [_rightBP] = operatorRegistry.get(right.operator).precedence;
  
  if (_leftBP.type === 'none') {
    if (_rightBP.type === 'none') return some('equal');
    return some('greater');
  }
  if (_rightBP.type === 'none') return some('less');

  if (_leftBP.value < _rightBP.value) return some('less');
  if (_leftBP.value === _rightBP.value) return some('equal');
  if (_leftBP.value > _rightBP.value) return some('greater');

  return none();
}

export const parseExpr  = (minPrecedenceOperator?: Operator): Parser<Operator, Expression, Error> => (parser) => {
  let lhs: Expression | undefined = parser.next();
  if (!lhs) return err(Error.UNEXPECTED_END);
  if (typeof lhs === 'object' && lhs.type === 'operator' && parser.context.operators.get(lhs.operator as RegistryKey).precedence[0].type === 'none') {
    const rhs = parseExpr(lhs)(parser);
    if (rhs.type == 'err') return err(rhs.err);
    
    lhs = { type: 'prefix', item: { operator: lhs, right: rhs.value } };
  }
  const comparator = compareOperators(parser.context.operators);

  while (true) {
    const peeked = parser.peek();
    if (!peeked) break;

    const cmpRes =
      comparator(peeked, minPrecedenceOperator);
    if (cmpRes.type === 'some' && cmpRes.value === 'less') break;
    parser.advance();

    if (typeof peeked === 'object' && peeked.type === 'operator' && parser.context.operators.get(peeked.operator as RegistryKey).precedence[1].type === 'none') {
      lhs = { type: 'postfix', item: { left: lhs as Expression, operator: peeked } };  
      continue;
    }

    const rhs = parseExpr(peeked)(parser);
    if (rhs.type == 'err') return err(rhs.err);    
    
    lhs = { type: 'infix', item: { left: lhs as Expression, operator: peeked, right: rhs.value } };
  }

  return ok(lhs);
  /*     let mut lhs = match lexer.next() {
        Token::Atom(it) => S::Atom(it),
        t => panic!("bad token: {:?}", t),
    };

    loop {
        let op = match lexer.peek() {
            Token::Eof => break,
            Token::Op(op) => op,
            t => panic!("bad token: {:?}", t),
        };

        let (l_bp, r_bp) = infix_binding_power(op);
        if l_bp < min_bp { 
            break;
        }

        lexer.next(); 
        let rhs = expr_bp(lexer, r_bp);

        lhs = S::Cons(op, vec![lhs, rhs]); 
    }

    lhs */
};