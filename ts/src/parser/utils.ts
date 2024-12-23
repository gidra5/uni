import { position, type Position } from "../utils/position";
import { assert } from "../utils";
import { TokenGroup, TokenGroupKind } from "./tokenGroups";

export type BaseContext = { index: number; rememberedIndex?: number };
type ParserContext<C> = Readonly<BaseContext & C>;
export type ParserFunction<in T, out U, C = {}> = (
  src: T,
  context: ParserContext<C>
) => [context: ParserContext<C>, ast: U];
type ParserFunctionOrParser<T, U, C = {}> = ParserFunction<T, U, C> | Parser<T, U, C>;
export type ParserGenerator<T, U1, U2, C = {}> = Generator<ParserFunctionOrParser<T, U1, C>, U2>;

export class Parser<in T, out U, C = {}> {
  constructor(public parse: ParserFunction<T, U, C>) {}

  map<U2>(f: (x: U, ctx: ParserContext<C>) => U2): Parser<T, U2, C> {
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
      return Parser.do<T, U2, C>(function* () {
        return yield* f(parsed);
      }).parse(src, ctx);
    });
  }

  zeroOrMore<T extends { length: number }>(this: Parser<T, U | null, C>): Parser<T, U[], C> {
    const parser = this.parse;
    return new Parser((src, ctx) => {
      const items: U[] = [];
      while (ctx.index < src.length) {
        let item: U | null;
        [ctx, item] = parser(src, ctx);
        if (!item) break;
        items.push(item);
      }
      return [ctx, items];
    });
  }

  all<T extends { length: number }, U>(this: Parser<T, U | null, C>, initialCtx: ParserContext<C>) {
    const parser = this.parse;
    return (src: T): U[] => {
      let ctx: ParserContext<C> = initialCtx;
      const items: U[] = [];
      while (ctx.index < src.length) {
        let item: U | null;
        [ctx, item] = parser(src, ctx);
        if (item) items.push(item);
      }
      return items;
    };
  }

  static or<T, U, C = BaseContext>(...parsers: ParserFunctionOrParser<T, U | null, C>[]) {
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

  static do<T, U, C = {}>(f: () => ParserGenerator<T, unknown, U, C>): Parser<T, U, C> {
    return new Parser((src, ctx) => {
      const gen = f();
      let value: unknown;

      while (true) {
        const { done, value: v } = gen.next(value!);
        if (done) return [ctx, v];

        let parser: ParserFunction<T, unknown, C>;
        if (v instanceof Parser) parser = v.parse;
        else parser = v;
        [ctx, value] = parser(src, ctx);
      }
    });
  }

  static scope<T, U, C = {}, C2 = C>(
    initialCtx: Readonly<C2>,
    f: () => ParserGenerator<T, unknown, U, NoInfer<C2>>
  ): Parser<T, U, C> {
    return new Parser((src, ctx) => {
      let _ctx: ParserContext<C2> = { ...ctx, ...initialCtx };
      const gen = f();
      let value: unknown;

      while (true) {
        const { done, value: v } = gen.next(value!);
        if (done) return [{ ...ctx, index: _ctx.index }, v];

        let parser: ParserFunction<T, unknown, C2>;
        if (v instanceof Parser) parser = v.parse;
        else parser = v;
        [_ctx, value] = parser(src, _ctx);
      }
    });
  }

  static advance<C>(inc = 1): Parser<any, void, C> {
    return new Parser((src, ctx) => [{ ...ctx, index: ctx.index + inc }, void 0]);
  }

  static index<C>(): Parser<any, number, C> {
    return new Parser((src, ctx) => [ctx, ctx.index]);
  }

  static rememberIndex<C>(i?: number): Parser<any, void, C> {
    return new Parser((src, ctx) => [{ ...ctx, rememberedIndex: i ?? ctx.index }, void 0]);
  }

  static resetIndex<C>(): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      assert(ctx.rememberedIndex !== undefined, "must be used after rememberIndex performed");
      return [{ ...ctx, index: ctx.rememberedIndex }, void 0];
    });
  }

  static rememberedIndex<C>(): Parser<any, number | undefined, C> {
    return new Parser((src, ctx) => [ctx, ctx.rememberedIndex]);
  }

  static span<C>(start?: number): Parser<any, Position, C> {
    return new Parser((src, ctx) => {
      if (start !== undefined) {
        return [ctx, position(start, ctx.index)];
      }
      assert(ctx.rememberedIndex !== undefined, "must be used after rememberIndex performed");
      return [ctx, position(ctx.rememberedIndex, ctx.index)];
    });
  }

  static substring<C>(): Parser<string, string, C> {
    return new Parser((src, ctx) => {
      assert(ctx.rememberedIndex !== undefined, "must be used after rememberIndex performed");
      return [ctx, src.substring(ctx.rememberedIndex, ctx.index)];
    });
  }

  static appendFollow<C extends { followSet: string[] }>(...strs: string[]): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      const followSet = [...ctx.followSet, ...strs];
      return [{ ...ctx, followSet }, void 0];
    });
  }

  static popFollow<C extends { followSet: string[] }>(size = 1): Parser<any, void, C> {
    return new Parser((src, ctx) => {
      assert(ctx.followSet.length > 0, "must popFollow only after appendFollow");
      const followSet = ctx.followSet.slice(0, -size);
      return [{ ...ctx, followSet }, void 0];
    });
  }

  static followSet<C extends { followSet: string[] }>(): Parser<any, string[], C> {
    return new Parser((src, ctx) => [ctx, ctx.followSet]);
  }

  static checkFollowSet<C extends { followSet: string[] }>(): Parser<any, boolean, C> {
    return new Parser((src, ctx) => {
      return [ctx, ctx.followSet.some((s) => src.startsWith(s, ctx.index))];
    });
  }

  static checkFollowSetPrev<C extends { followSet: string[] }>(): Parser<any, boolean, C> {
    return new Parser((src, ctx) => {
      return [ctx, ctx.followSet.some((s) => src.startsWith(s, ctx.index - 1))];
    });
  }

  static isEnd<T extends { length: number }, C>(): Parser<T, boolean, C> {
    return new Parser((src, ctx) => [ctx, ctx.index >= src.length]);
  }

  static isNotEnd<T extends { length: number }, C>(): Parser<T, boolean, C> {
    return new Parser((src, ctx) => [ctx, ctx.index < src.length]);
  }

  static src<T, C>(): Parser<T, T, C> {
    return new Parser((src, ctx) => [ctx, src]);
  }

  static ctx<C>(): Parser<any, C, C> {
    return new Parser((src, ctx) => [ctx, ctx]);
  }

  static update<C>(ctx: Partial<C>): Parser<any, void, C> {
    return new Parser((src, _ctx) => [{ ..._ctx, ...ctx }, void 0]);
  }

  static next<T>(): Parser<T[], T | undefined, any> {
    return new Parser((src, ctx) => [{ ...ctx, index: ctx.index + 1 }, src[ctx.index]]);
  }

  static peek<T>(inc = 0): Parser<T[], T | undefined, any> {
    return new Parser((src, ctx) => [ctx, src[ctx.index + inc]]);
  }

  static prev<T>(): Parser<T[], T | undefined, any> {
    return Parser.peek(-1);
  }

  static nextChar<C>(): Parser<string, string, C> {
    return new Parser((src, ctx) => [{ ...ctx, index: ctx.index + 1 }, src.charAt(ctx.index)]);
  }

  static peekChar<C>(inc = 0): Parser<string, string, C> {
    return new Parser((src, ctx) => [ctx, src.charAt(ctx.index + inc)]);
  }

  static prevChar<C>(): Parser<string, string, C> {
    return Parser.peekChar(-1);
  }

  static peekSubstring<C>(size: number) {
    return new Parser<string, string, C>((src, ctx) => [ctx, src.substring(ctx.index, ctx.index + size)]);
  }

  static prevSubstring<C>(size: number): Parser<string, string, C> {
    return new Parser<string, string, C>((src, ctx) => [ctx, src.substring(ctx.index - size, ctx.index)]);
  }

  static identifier<C>(name?: string): Parser<TokenGroup[], boolean, C> {
    return new Parser((src, ctx) => {
      const token: TokenGroup | undefined = src[ctx.index];
      if (!token) return [ctx, false];
      if (token.type !== "identifier") return [ctx, false];
      const matches = !name || token.name === name;
      const index = matches ? ctx.index + 1 : ctx.index;
      return [{ ...ctx, index }, matches];
    });
  }

  static checkIdentifier<C>(name?: string): Parser<TokenGroup[], boolean, C> {
    return new Parser((src, ctx) => {
      const token: TokenGroup | undefined = src[ctx.index];
      if (!token) return [ctx, false];
      if (token.type !== "identifier") return [ctx, false];
      const matches = !name || token.name === name;
      return [ctx, matches];
    });
  }

  static newline<C>(): Parser<TokenGroup[], boolean, C> {
    return new Parser((src, ctx) => {
      const token: TokenGroup | undefined = src[ctx.index];
      if (!token) return [ctx, false];
      if (token.type !== "newline") return [ctx, false];
      return [{ ...ctx, index: ctx.index + 1 }, true];
    });
  }

  static checkNewline<C>(): Parser<TokenGroup[], boolean, C> {
    return new Parser((src, ctx) => {
      const token: TokenGroup | undefined = src[ctx.index];
      if (!token) return [ctx, false];
      if (token.type !== "newline") return [ctx, false];
      return [ctx, true];
    });
  }

  static checkGroup<C>(kind?: TokenGroupKind): Parser<TokenGroup[], boolean, C> {
    return new Parser((src, ctx) => {
      const token: TokenGroup | undefined = src[ctx.index];
      if (!token) return [ctx, false];
      if (token.type !== "group") return [ctx, false];
      const matches = !kind || ("kind" in token && token.kind === kind);
      const index = matches ? ctx.index + 1 : ctx.index;
      return [{ ...ctx, index }, true];
    });
  }

  static string<C>(s: string): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const matches = src.startsWith(s, ctx.index);
      const index = matches ? ctx.index + s.length : ctx.index;
      return [{ ...ctx, index }, matches];
    });
  }

  static checkString<C>(s: string): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const matches = src.startsWith(s, ctx.index);
      return [ctx, matches];
    });
  }

  static oneOfStrings<C>(...ss: string[]): Parser<string, string | null, C> {
    return new Parser((src, ctx) => {
      for (const s of ss) {
        const matches = src.startsWith(s, ctx.index);
        if (matches) return [{ ...ctx, index: ctx.index + s.length }, s];
      }
      return [ctx, null];
    });
  }

  static regexp<C>(regex: RegExp): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const currentChar = src.charAt(ctx.index);
      const matches = regex.test(currentChar);
      return [{ ...ctx, index: matches ? ctx.index + 1 : ctx.index }, matches];
    });
  }

  static checkRegexp<C>(regex: RegExp): Parser<string, boolean, C> {
    return new Parser((src, ctx) => {
      const currentChar = src.charAt(ctx.index);
      const matches = regex.test(currentChar);
      return [ctx, matches];
    });
  }

  static untilString<C>(s: string): Parser<string, void, C> {
    return Parser.do(function* () {
      while ((yield Parser.isNotEnd()) && !(yield Parser.string(s))) {
        yield Parser.advance();
      }
    });
  }
}
