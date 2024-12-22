import { position, type Position } from "../utils/position";
import { assert } from "../utils";

export type BaseContext = { index: number; rememberedIndex?: number };
export type ParserFunction<in T, out U, C extends BaseContext = BaseContext> = (
  src: T,
  context: Readonly<C>
) => [context: Readonly<C>, ast: U];
type ParserFunctionOrParser<T, U, C extends BaseContext = BaseContext> = ParserFunction<T, U, C> | Parser<T, U, C>;
type ParserGenerator<T, U1, U2, C extends BaseContext = BaseContext> = Generator<ParserFunctionOrParser<T, U1, C>, U2>;

export class Parser<in T, out U, C extends BaseContext = BaseContext> {
  constructor(public parse: ParserFunction<T, U, C>) {}

  map<U2>(f: (x: U, ctx: C) => U2): Parser<T, U2, C> {
    const parser = this.parse;
    return new Parser((src, ctx) => {
      let parsed: U;
      [ctx, parsed] = parser(src, ctx);
      return [ctx, f(parsed, ctx)];
    });
  }

  then<U2>(f: (x: U) => ParserFunction<T, U2, C>): Parser<T, U2, C> {
    const parser = this.parse;
    return new Parser((src, ctx) => {
      let parsed: U;
      [ctx, parsed] = parser(src, ctx);
      return f(parsed)(src, ctx);
    });
  }

  chain<U2>(f: (x: U) => ParserGenerator<T, unknown, U2, C>): Parser<T, U2, C> {
    const parser = this.parse;
    return new Parser((src, ctx) => {
      let parsed: U;
      [ctx, parsed] = parser(src, ctx);
      return _do<T, U2, C>(function* () {
        return yield* f(parsed);
      })(src, ctx);
    });
  }

  zeroOrMore<T extends { length: number }>(this: Parser<T, U, C>): Parser<T, U[], C> {
    const parser = this.parse;
    return new Parser((src, ctx) => {
      const items: U[] = [];
      while (ctx.index < src.length) {
        let item: U;
        [ctx, item] = parser(src, ctx);
        if (!item) break;
        items.push(item);
      }
      return [ctx, items];
    });
  }

  all<T extends { length: number }, U>(this: Parser<T, U | null, C>, initialCtx: C) {
    const parser = this.parse;
    return (src: T): U[] => {
      let ctx: C = initialCtx;
      const items: U[] = [];
      while (ctx.index < src.length) {
        let item: U | null;
        [ctx, item] = parser(src, ctx);
        if (item) items.push(item);
      }
      return items;
    };
  }

  static or<T, U, C extends BaseContext = BaseContext>(...parsers: ParserFunctionOrParser<T, U | null, C>[]) {
    return new Parser<T, U | null, C>((src, ctx) => {
      for (const parser of parsers) {
        let f: ParserFunction<T, U | null, C>;
        if (parser instanceof Parser) f = parser.parse;
        else f = parser;
        const parsed = f(src, ctx);
        if (parsed[1]) return parsed;
      }
      return [ctx, null];
    });
  }

  static do<T, U, C extends BaseContext = BaseContext>(
    f: () => Generator<ParserFunctionOrParser<T, unknown, C>, U, any>
  ): Parser<T, U, C> {
    return new Parser((src, ctx) => {
      const gen = f();
      let value: unknown;

      while (true) {
        let parser: ParserFunction<T, unknown, C>;
        const { done, value: v } = gen.next(value!);

        if (done) return [ctx, v];
        if (v instanceof Parser) parser = v.parse;
        else parser = v;
        [ctx, value] = parser(src, ctx);
      }
    });
  }

  static advance<C extends BaseContext>(inc = 1): Parser<any, void, C> {
    return new Parser((src, ctx) => [{ ...ctx, index: ctx.index + inc }, void 0]);
  }

  static index<C extends BaseContext>(): Parser<any, number, C> {
    return new Parser((src, ctx) => [ctx, ctx.index]);
  }

  static rememberIndex<C extends BaseContext>(i?: number): Parser<any, void, C> {
    return new Parser((src, ctx) => [{ ...ctx, rememberedIndex: i ?? ctx.index }, void 0]);
  }

  static resetIndex<C extends BaseContext>(i?: number): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      const index = i ?? ctx.rememberedIndex;
      assert(index !== undefined, "must be used after rememberIndex performed");
      return [{ ...ctx, index }, void 0];
    });
  }

  static rememberedIndex<C extends BaseContext>(): Parser<any, number | undefined, C> {
    return new Parser((src, ctx) => [ctx, ctx.rememberedIndex]);
  }

  static forgetIndex<C extends BaseContext>(): Parser<any, void, C> {
    return new Parser((src, ctx) => [{ ...ctx, rememberedIndex: undefined }, void 0]);
  }

  static span<C extends BaseContext>(start?: number): Parser<any, Position, C> {
    return new Parser((src, ctx) => {
      if (start !== undefined) {
        return [ctx, position(start, ctx.index)];
      }
      assert(ctx.rememberedIndex !== undefined, "must be used after rememberIndex performed");
      return [ctx, position(ctx.rememberedIndex, ctx.index)];
    });
  }

  static substring<C extends BaseContext>(): Parser<any, string, C> {
    return new Parser((src, ctx) => {
      assert(ctx.rememberedIndex !== undefined, "must be used after rememberIndex performed");
      return [ctx, src.substring(ctx.rememberedIndex, ctx.index)];
    });
  }

  static appendFollow<C extends BaseContext & { followSet: string[] }>(str: string): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      const followSet = [...ctx.followSet, str];
      return [{ ...ctx, followSet }, void 0];
    });
  }

  static popFollow<C extends BaseContext & { followSet: string[] }>(): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      assert(ctx.followSet.length > 0, "must popFollow only after appendFollow");
      const followSet = ctx.followSet.slice(0, -1);
      return [{ ...ctx, followSet }, void 0];
    });
  }

  static followSet<C extends BaseContext & { followSet: string[] }>(): Parser<any, string[], C> {
    return new Parser((src, ctx) => {
      return [ctx, ctx.followSet];
    });
  }

  static checkFollowSet<C extends BaseContext & { followSet: string[] }>(): Parser<any, boolean, C> {
    return new Parser((src, ctx) => {
      return [ctx, ctx.followSet.some((s) => src.startsWith(s, ctx.index))];
    });
  }

  static checkFollowSetPrev<C extends BaseContext & { followSet: string[] }>(): Parser<any, boolean, C> {
    return new Parser((src, ctx) => {
      return [ctx, ctx.followSet.some((s) => src.startsWith(s, ctx.index - 1))];
    });
  }

  static isEnd<T extends { length: number }, C extends BaseContext>(): Parser<T, boolean, C> {
    return new Parser((src, ctx) => [ctx, ctx.index >= src.length]);
  }

  static isNotEnd<T extends { length: number }, C extends BaseContext>(): Parser<T, boolean, C> {
    return new Parser((src, ctx) => [ctx, ctx.index < src.length]);
  }

  static src<T, C extends BaseContext>(): Parser<T, T, C> {
    return new Parser((src, ctx) => [ctx, src]);
  }

  static ctx<T, C extends BaseContext>(): Parser<T, C, C> {
    return new Parser((src, ctx) => [ctx, ctx]);
  }

  static nextChar<C extends BaseContext>(): Parser<string, string, C> {
    return new Parser((src, ctx) => [{ ...ctx, index: ctx.index + 1 }, src.charAt(ctx.index)]);
  }

  static peekChar<C extends BaseContext>(inc = 0): Parser<string, string, C> {
    return new Parser((src, ctx) => [ctx, src.charAt(ctx.index + inc)]);
  }

  static prevChar<C extends BaseContext>(): Parser<string, string, C> {
    return Parser.peekChar(-1);
  }

  static peekSubstring<C extends BaseContext>(size: number) {
    return new Parser<string, string, C>((src, ctx) => [ctx, src.substring(ctx.index, ctx.index + size)]);
  }

  static prevSubstring<C extends BaseContext>(size: number): Parser<string, string, C> {
    return new Parser<string, string, C>((src, ctx) => [ctx, src.substring(ctx.index - size, ctx.index)]);
  }

  static string<C extends BaseContext>(s: string): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const matches = src.startsWith(s, ctx.index);
      const index = matches ? ctx.index + s.length : ctx.index;
      return [{ ...ctx, index }, matches];
    });
  }

  static checkString<C extends BaseContext>(s: string): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const matches = src.startsWith(s, ctx.index);
      return [ctx, matches];
    });
  }

  static oneOfStrings<C extends BaseContext>(...ss: string[]): Parser<string, string | null, C> {
    return new Parser((src, ctx) => {
      for (const s of ss) {
        const matches = src.startsWith(s, ctx.index);
        if (matches) return [{ ...ctx, index: ctx.index + s.length }, s];
      }
      return [ctx, null];
    });
  }

  static regexp<C extends BaseContext>(regex: RegExp): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const currentChar = src.charAt(ctx.index);
      const matches = regex.test(currentChar);
      return [{ ...ctx, index: matches ? ctx.index + 1 : ctx.index }, matches];
    });
  }

  static checkRegexp<C extends BaseContext>(regex: RegExp): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const currentChar = src.charAt(ctx.index);
      const matches = regex.test(currentChar);
      return [ctx, matches];
    });
  }

  static untilString<C extends BaseContext>(s: string): Parser<string, void, C> {
    return Parser.do(function* () {
      while ((yield Parser.isNotEnd()) && !(yield Parser.string(s))) {
        yield Parser.advance();
      }
    });
  }
}

export const _do = <T, U, C extends BaseContext = BaseContext>(
  f: () => ParserGenerator<T, unknown, U, C>
): ParserFunction<T, U, C> => Parser.do(f).parse;

export const all =
  <T extends { length: number }, U>(p: ParserFunction<T, U>) =>
  (src: T): U[] =>
    new Parser(p).zeroOrMore().parse(src, { index: 0 })[1];
