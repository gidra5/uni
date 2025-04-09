import { TupleN } from "../types";
import { assert } from "../utils";

type Lambda =
  | { type: "var"; id: number }
  | { type: "app"; func: Term; arg: Term }
  | { type: "fn"; body: (term: Term) => Term };
type Handlers =
  | { type: "inject"; id: number; handler: (term: Term, cont: Term) => Term; return: (term: Term) => Term; body: Term }
  | { type: "handle"; id: number; value: Term };
type Process =
  | { type: "channel"; sender: (sender: Term) => Term; receiver: (receiver: Term) => Term }
  | { type: "send"; id: number; value: Term; rest: Term }
  | { type: "receive"; ids: number[] };
type Term = Lambda | Handlers | Process;

let id = 0;
const nextId = () => id++;

const name = (id = nextId()) => ({ type: "var", id } satisfies Term);
const _app = (func: Term, arg: Term) => ({ type: "app", func, arg } satisfies Term);
const app = (func: Term, ...[head, ...rest]: Term[]) =>
  rest.length === 0 ? _app(func, head) : (app(_app(func, head), ...rest) satisfies Term);
const fn = (body: (term: Term) => Term) => ({ type: "fn", body } satisfies Term);
const fnN = <const N extends number>(n: N, body: (...terms: TupleN<N, Term>) => Term) =>
  n === 1 ? fn(body as any) : (fn((term) => fnN(n - 1, (...rest) => body(...([term, ...rest] as any)))) satisfies Term);
const _let = (value: Term, body: (term: Term) => Term) => app(fn(body), value);
const seq = (...[head, ...rest]: Term[]) => (rest.length === 0 ? head : _let(head, () => seq(...rest)));

const tuple = (...args: Term[]) =>
  app(
    fnN(args.length, (...terms) => fn((m) => app(m, ...terms))),
    ...args
  );

const either = (x: Term, n: number, i: number) =>
  app(
    fn((x) => fnN(n, (...terms) => app(terms[i], x))),
    x
  );

const cleanSelf = (f: Term) =>
  app(
    fn((x) => app(x, x)),
    fn((self) => app(f, app(self, self)))
  );
const fix = (f: (self: Term) => Term) => cleanSelf(fn(f));

const zero = fnN(2, (f: Term, x: Term) => x);
const succ = fn((n) => fnN(2, (f: Term, x: Term) => app(f, app(n, f, x))));
const add = fnN(2, (x, y) => app(y, succ, x));
const mult = fnN(2, (x, y) => app(y, app(add, x), zero));
const exp = fnN(2, (x, y) => app(y, app(mult, x), app(succ, zero)));
const num = (n: number) => (n === 0 ? zero : app(succ, num(n - 1)));
const enumZero = fnN(2, (s: Term, z: Term) => z);
const enumSucc = fn((n) => fnN(2, (s: Term, z: Term) => app(s, n)));
const numToEnum = (n: Term) => app(n, enumSucc, enumZero);
const enumNumToNum = (n: Term) =>
  app(
    n,
    fn((n) => app(succ, enumNumToNum(n))),
    zero
  );
const pred = fn((n) =>
  enumNumToNum(
    app(
      numToEnum(n),
      fn((pred) => pred),
      enumZero
    )
  )
);
const sub = fnN(2, (x, y) => app(y, pred, x));
const div = fnN(2, (x, y) => _if(app(isZero, x), zero, app(succ, app(div, app(sub, x, y), y))));
const isZero = fn((n) =>
  app(
    n,
    fn((x) => bool(false)),
    bool(true)
  )
);
const isEq = fnN(2, (x, y) =>
  app(
    numToEnum(x),
    fn((predX) =>
      app(
        numToEnum(y),
        fn((predY) => app(isEq, predX, predY)),
        bool(false)
      )
    ),
    app(isZero, y)
  )
);
const isLess = fnN(2, (x, y) =>
  app(
    numToEnum(x),
    fn((predX) =>
      app(
        numToEnum(y),
        fn((predY) => app(isLess, predX, predY)),
        bool(false)
      )
    ),
    app(not, app(isZero, y))
  )
);

const bool = (b: boolean) => (b ? fnN(2, (x, y) => x) : fnN(2, (x, y) => y));
const not = fn((x) => app(x, bool(false), bool(true)));
const and = fnN(2, (x, y) => app(x, y, bool(false)));
const or = fnN(2, (x, y) => app(x, bool(true), y));
const _if = fnN(3, (cond, then, _else) => app(cond, then, _else));

type Context = {
  vars: Map<number, Term>;
  cont?: (term: Term) => Term;
};

const _eval = (term: Term, ctx: Context): Term => {
  const cont = ctx.cont ?? ((term) => term);

  switch (term.type) {
    case "var":
      return cont(ctx.vars.get(term.id)!);
    case "app":
      return _eval(term.func, {
        ...ctx,
        cont: (fn) =>
          _eval(term.arg, {
            ...ctx,
            cont: (arg) => {
              // // console.log("fn, arg", fn, arg);
              assert(fn.type === "fn", "not a function");

              return _eval(fn.body(arg), ctx);
            },
          }),
      });
    case "fn":
      return cont(term);
    // case 'inject':
    //   return _eval(term.body, {
    //     ...ctx,
    //     cont: (value) => {
    //       if
    //     },
    //   });
  }
};
const toNumber = (n: Term) => {
  let i = 0;
  _eval(
    app(
      n,
      fn(() => (i++, zero)),
      zero
    ),
    { vars: new Map() }
  );
  return i;
};
const toBool = (b: Term) => {
  let res: boolean;
  _eval(
    app(
      b,
      fn((x) => ((res = true), x)),
      fn((x) => ((res = false), x)),
      zero
    ),
    { vars: new Map() }
  );

  return res!;
};

export {};

if (import.meta.vitest) {
  const { describe, expect, beforeEach } = import.meta.vitest;
  const { test, fc } = await import("@fast-check/vitest");

  beforeEach(() => {
    id = 0;
  });

  describe("lambda", () => {
    test("id", () => {
      const ctx = { vars: new Map() };
      const value = name();
      ctx.vars.set(value.id, value);

      const term = app(
        fn((x) => x),
        value
      );
      expect(_eval(term, ctx)).toEqual(value);
    });

    test("tuple", () => {
      const ctx = { vars: new Map() };
      const value1 = name();
      const value2 = name();
      ctx.vars.set(value1.id, value1);
      ctx.vars.set(value2.id, value2);

      const term = app(
        tuple(value1, value2),
        fnN(2, (x, y) => y)
      );
      expect(_eval(term, ctx)).toEqual(value2);
    });

    test("either", () => {
      const ctx = { vars: new Map() };
      const value1 = name();
      const value2 = name();
      ctx.vars.set(value1.id, value1);
      ctx.vars.set(value2.id, value2);

      const term = app(
        app(
          either(value1, 2, 0),
          fn((x) => tuple(value1, x)),
          fn((x) => tuple(value2, x))
        ),
        fnN(2, (x, y) => x)
      );
      expect(_eval(term, ctx)).toEqual(value1);
    });

    test("count", () => {
      const term = num(5);
      expect(toNumber(term)).toEqual(5);
    });

    test("add", () => {
      const term1 = num(5);
      const term2 = num(3);
      const term = app(add, term1, term2);
      expect(toNumber(term)).toEqual(8);
    });

    test("mult", () => {
      const term1 = num(5);
      const term2 = num(3);
      const term = app(mult, term1, term2);
      expect(toNumber(term)).toEqual(15);
    });

    test("exp", () => {
      const term1 = num(5);
      const term2 = num(3);
      const term = app(exp, term1, term2);
      expect(toNumber(term)).toEqual(125);
    });

    test("pred", () => {
      const term = app(pred, num(5));
      expect(toNumber(term)).toEqual(4);
    });

    test("sub", () => {
      const term1 = num(5);
      const term2 = num(3);
      const term = app(sub, term1, term2);
      expect(toNumber(term)).toEqual(2);
    });

    test("div", () => {
      const term1 = num(0);
      const term2 = num(1);
      const term = app(div, term1, term2);
      expect(toNumber(term)).toEqual(0);
    });

    test("isZero", () => {
      const term = app(isZero, num(0));
      expect(toBool(term)).toEqual(true);
    });

    test("isZero 2", () => {
      const term = app(isZero, num(1));
      expect(toBool(term)).toEqual(false);
    });

    test("isEq", () => {
      const term1 = num(5);
      const term2 = num(5);
      const term = app(isEq, term1, term2);
      expect(toBool(term)).toEqual(true);
    });

    test("isEq 2", () => {
      const term1 = num(5);
      const term2 = num(6);
      const term = app(isEq, term1, term2);
      expect(toBool(term)).toEqual(false);
    });

    test("isLess", () => {
      const term1 = num(5);
      const term2 = num(5);
      const term = app(isLess, term1, term2);
      expect(toBool(term)).toEqual(false);
    });

    test("isLess 2", () => {
      const term1 = num(5);
      const term2 = num(6);
      const term = app(isLess, term1, term2);
      expect(toBool(term)).toEqual(true);
    });

    test("bool", () => {
      const term = bool(true);
      expect(toBool(term)).toEqual(true);
    });

    test("not", () => {
      const term = app(not, bool(true));
      expect(toBool(term)).toEqual(false);
    });

    test("and", () => {
      const term = app(and, bool(true), bool(false));
      expect(toBool(term)).toEqual(false);
    });

    test("or", () => {
      const term = app(or, bool(false), bool(true));
      expect(toBool(term)).toEqual(true);
    });

    test("fib fix", () => {
      const ctx = { vars: new Map() };

      const term = app(
        fix((self) =>
          fn((n) => _if(app(isZero, n), zero, app(add, app(self, app(pred, n)), app(self, app(sub, n, num(2))))))
        ),
        num(6)
      );
      expect(toNumber(term)).toEqual(5);
    });

    test("sequence", () => {
      const term = seq(num(1), num(2), num(3));
      expect(toNumber(term)).toEqual(3);
    });

    test("let", () => {
      const term = _let(num(1), (x) => app(add, x, num(2)));
      expect(toNumber(term)).toEqual(3);
    });
  });
}
