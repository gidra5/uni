import { err, ok, Result, none } from "../types.mjs";
import {
  isOperator,
  Operator,
  OperatorRegistry,
  Parser,
  ParserRecovery,
  Precedence,
  Error,
} from "./types.mjs";

export class ParsingHandler<T, U> {
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

  *parse<E>(
    ...args:
      | [handler: Parser<T, U, Error>]
      | [handler: Parser<T, U, E>, recover: ParserRecovery<T, U, E>]
  ) {
    const [handler, recover] = args;
    while (this.peek()) {
      // const start = this.index;
      const item = handler(this);

      if (item.type === "err") {
        let error = item.err;

        if (recover) {
          error = recover(this, item.err as E);
          this.setIndex();
        }

        if (error === Error.SKIP) continue;
        // yield { start, end: this.index, item: err<U, Error>(error as Error) };
        yield err<U, Error>(error as Error);
      } else {
        this.setIndex();
        // yield { start, end: this.index, item: ok<U, Error>(item.value) };
        yield ok<U, Error>(item.value);
      }
    }
  }
}

export const transpose = <T,>(x: Result<T, Error>[]): [T[], Error[]] => {
  const operands = [] as T[];
  const errors = [] as Error[];

  for (const it of x) {
    if (it.type === "err") errors.push(it.err);
    else operands.push(it.value);
  }

  return [operands, errors];
};

export const DEFAULT_PRECEDENCE = [none(), none()] as Precedence;
/**
 *
 * @param operatorRegistry
 * @returns left is `less`\\`greater`\\`equal` to right, or can't be compared
 */
export const compareOperators =
  (operatorRegistry: OperatorRegistry) =>
  (left?: Operator, right?: Operator): boolean => {
    if (isOperator(left)) console.log("c3", operatorRegistry.get(left.item));
    if (isOperator(right)) console.log("c4", operatorRegistry.get(right.item));

    const [, _leftBP] = isOperator(left)
      ? operatorRegistry.get(left.item).precedence ?? DEFAULT_PRECEDENCE
      : DEFAULT_PRECEDENCE;
    const [_rightBP] = isOperator(right)
      ? operatorRegistry.get(right.item).precedence ?? DEFAULT_PRECEDENCE
      : DEFAULT_PRECEDENCE;

    if (_rightBP.type === "none") return false;
    if (_leftBP.type === "none") return true;

    return _leftBP.value < _rightBP.value;
  };
