import { TupleN } from "../types";
import { assert, unreachable } from "../utils";

type Lambda =
  | { type: "var"; id: number }
  | { type: "app"; func: Term; arg: Term }
  | { type: "fn"; id: number; body: Term };
type Handlers =
  | { type: "inject"; id: number; handler: Term; return: Term; body: Term }
  | { type: "handle"; id: number; value: Term }
  | { type: "mask"; id: number; body: Term };
type Process =
  | { type: "channel"; sender: Term; receiver: Term }
  | { type: "send"; id: number; value: Term; rest: Term }
  | { type: "receive"; ids: number[] };
type Term = Lambda | Handlers | Process;

let id = 0;
const nextId = () => id++;

const name = (id = nextId()) => ({ type: "var", id } satisfies Term);
const _app = (func: Term, arg: Term) => ({ type: "app", func, arg } satisfies Term);
const app = (func: Term, ...[head, ...rest]: Term[]) =>
  rest.length === 0 ? _app(func, head) : (app(_app(func, head), ...rest) satisfies Term);
const fn = (body: (term: () => Term) => Term) => {
  const id = nextId();
  return { type: "fn", id, body: body(() => name(id)) } satisfies Term;
  // const lvl = fnLvl++;
  // const _body = body(() => name(fnLvl - lvl - 1));
  // const x = { type: "fn", body: _body } satisfies Term;
  // fnLvl--;
  // return x;
};
const fnN = <const N extends number>(n: N, body: (...terms: TupleN<N, () => Term>) => Term): Term =>
  n === 1 ? fn(body as any) : fn((term) => fnN(n - 1, (...rest) => body(...([term, ...rest] as any))));
const _let = (value: Term, body: (term: () => Term) => Term) => app(fn(body), value);
const seq = (...[head, ...rest]: Term[]) => (rest.length === 0 ? head : _let(head, () => seq(...rest)));
const pipe = (...[head, next, ...rest]: Term[]) =>
  rest.length === 0 ? app(next, head) : pipe(app(next, head), ...rest);
const inject = (x: { id?: number; handler: Term; return?: Term; body: Term }) => {
  const { id = nextId(), return: ret = fn((term) => term()) } = x;
  return { type: "inject", ...x, id, return: ret } satisfies Term;
};
const handle = (id: number, value: Term) => ({ type: "handle", id, value } satisfies Term);
const mask = (id: number, body: Term) => ({ type: "mask", id, body } satisfies Term);
const without = (id: number, body: Term) => inject({ id, handler: fn(() => unreachable("effect forbidden")), body });

const tuple = (...args: Term[]) =>
  app(
    fnN(args.length, (...terms) => fn((m) => app(m(), ...terms.map((x) => x())))),
    ...args
  );
const index = (tup: Term, n: number, i: number) =>
  app(
    tup,
    fnN(n, (...terms) => terms[i]())
  );

const either = (x: Term, n: number, i: number) =>
  app(
    fn((x) => fnN(n, (...terms) => app(terms[i](), x()))),
    x
  );

// const cleanSelf = (f: Term) =>
//   app(
//     fn((x) => app(x, x)),
//     fn((self) => app(f, app(self, self)))
//   );
// const fix = (f: (self: Term) => Term) => cleanSelf(fn(f));

const zero = () => fnN(2, (f, x) => x());
const succ = () => fn((n) => fnN(2, (f, x) => app(f(), app(n(), f(), x()))));
const add = () => fnN(2, (x, y) => app(y(), succ(), x()));
const mult = () => fnN(2, (x, y) => app(y(), app(add(), x()), zero()));
// const exp = () => fnN(2, (x, y) => app(y, app(mult, x), app(succ, zero)));
const num = (n: number) => (n === 0 ? zero() : app(succ(), num(n - 1)));
// const enumZero = fnN(2, (s: Term, z: Term) => z);
// const enumSucc = fn((n) => fnN(2, (s: Term, z: Term) => app(s, n)));
// const numToEnum = (n: Term) => app(n, enumSucc, enumZero);
// const enumNumToNum = (n: Term) =>
//   app(
//     n,
//     fn((n) => app(succ, enumNumToNum(n))),
//     zero
//   );
// const pred = fn((n) =>
//   enumNumToNum(
//     app(
//       numToEnum(n),
//       fn((pred) => pred),
//       enumZero
//     )
//   )
// );
// const sub = fnN(2, (x, y) => app(y, pred, x));
// const div = fnN(2, (x, y) => _if(app(isZero, x), zero, app(succ, app(div, app(sub, x, y), y))));
// const isZero = fn((n) =>
//   app(
//     n,
//     fn((x) => bool(false)),
//     bool(true)
//   )
// );
// const isEq = fnN(2, (x, y) =>
//   app(
//     numToEnum(x),
//     fn((predX) =>
//       app(
//         numToEnum(y),
//         fn((predY) => app(isEq, predX, predY)),
//         bool(false)
//       )
//     ),
//     app(isZero, y)
//   )
// );
// const isLess = fnN(2, (x, y) =>
//   app(
//     numToEnum(x),
//     fn((predX) =>
//       app(
//         numToEnum(y),
//         fn((predY) => app(isLess, predX, predY)),
//         bool(false)
//       )
//     ),
//     app(not, app(isZero, y))
//   )
// );

// const bool = (b: boolean) => (b ? fnN(2, (x, y) => x) : fnN(2, (x, y) => y));
// const not = fn((x) => app(x, bool(false), bool(true)));
// const and = (x: Term, y: Term) => app(x, y, bool(false));
// const or = (x: Term, y: Term) => app(x, bool(true), y);
// const _if = (cond: Term, then: Term, _else: Term) => app(cond, then, _else);

type Context = {
  vars: Map<number, Term>;
  handlers: { handler: Term; id: number }[];
  handlerIds: Map<number, number>; // id -> index
};
const newContext = (): Context => ({ vars: new Map(), handlers: [], handlerIds: new Map() });
const contextSetVar = (ctx: Context, id: number, value: Term) => {
  ctx = { ...ctx, vars: new Map(ctx.vars).set(id, value) };
  return ctx;
  // const _ctx = { ...ctx, vars: [...ctx.vars, value] };
  // return _ctx;
};

const _eval = (term: Term, ctx = newContext()): Term => {
  // console.dir({ m: 1, term, ctx }, { depth: null });
  switch (term.type) {
    case "var":
      return ctx.vars.get(term.id) ?? term;
    // return ctx.vars[ctx.vars.length - 1 - term.idx] ?? term;
    case "fn":
      // const id = term.id;
      // const id = nextId();
      // return { ...term, id, body: _eval(term.body, contextSetVar(ctx, term.id, name(id))) };
      return term;
    case "app":
      const func = _eval(term.func, ctx);
      const arg = _eval(term.arg, ctx);
      // console.dir({ m: 2, term, ctx, func, arg }, { depth: null });
      // if (func.type !== "fn") return { ...term, func, arg };
      if (func.type !== "fn") return term;
      ctx = contextSetVar(ctx, func.id, arg);
      const x = _eval(func.body, ctx);
      // console.dir(["x", x, ctx], { depth: null });

      return x;
  }
};
const _toNumber = (n: Term) => {
  // console.dir({ n }, { depth: null });
  assert(n.type === "fn");
  const body = n.body;
  const fnId = n.id;

  assert(body.type === "fn");
  let bodyBody = body.body;
  const argId = body.id;
  let i = 0;

  while (true) {
    if (bodyBody.type === "var" && bodyBody.id === argId) {
      return i;
    }
    assert(bodyBody.type === "app");
    assert(bodyBody.func.type === "var");
    assert(bodyBody.func.id === fnId);

    i++;
    bodyBody = bodyBody.arg;
  }
};
const toNumber = (n: Term) => {
  // console.dir({ n }, { depth: null });

  return _toNumber(_eval(n));
};
const toBool = (b: Term) => {
  let res: boolean;
  _eval(
    app(
      b,
      fn((x) => ((res = true), x())),
      fn((x) => ((res = false), x())),
      zero()
    )
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
      const ctx = newContext();
      const value = name(0);
      const term = app(
        fn((x) => x()),
        value
      );
      expect(_eval(term, ctx)).toEqual(value);
    });

    test("tuple", () => {
      const ctx = newContext();
      const value1 = name();
      const value2 = name();
      const term = app(
        tuple(value1, value2),
        fnN(2, (x, y) => y())
      );
      expect(_eval(term, ctx)).toEqual(value2);
    });

    test("either", () => {
      const ctx = newContext();
      const value1 = name();
      const value2 = name();
      const term = index(
        app(
          either(value1, 2, 0),
          fn((x) => tuple(value1, x())),
          fn((x) => tuple(value2, x()))
        ),
        2,
        0
      );
      expect(_eval(term, ctx)).toEqual(value1);
    });

    // test.only("either2", () => {
    //   const ctx = newContext();
    //   const value1 = name();
    //   const term = app(
    //     fn((x) => fnN(2, (a) => app(a(), x()))),
    //     value1
    //   );
    //   expect(_eval(term, ctx)).toEqual(fnN(2, (a) => app(a(), value1)));
    // });

    test.only("either3", () => {
      const ctx = newContext();
      const value1 = name();
      const value2 = name();
      const term = app(
        app(
          app(
            fn((x) => fnN(2, (a) => app(a(), x()))),
            value1
          ),
          fn((x) => tuple(value1, x())),
          fn((x) => tuple(value2, x()))
        ),
        fnN(2, (x) => x())
      );
      expect(_eval(term, ctx)).toEqual(value1);
    });

    // test("count zero", () => {
    //   expect(toNumber(zero())).toEqual(0);
    // });

    // test.prop([fc.integer({ min: 0, max: 1024 })])("count", (n) => {
    //   const term1 = num(n);
    //   expect(toNumber(term1)).toEqual(n);
    // });

    // test.prop([fc.integer({ min: 0, max: 1024 })])("count succ", (n) => {
    //   const term1 = num(n);
    //   const term = app(succ(), term1);
    //   expect(toNumber(term)).toEqual(n + 1);
    // });

    // test.prop([fc.integer({ min: 0, max: 1024 }), fc.integer({ min: 0, max: 1024 })])("add", (n, m) => {
    //   const term1 = num(n);
    //   const term2 = num(m);
    //   const term = app(add(), term1, term2);
    //   expect(toNumber(term)).toEqual(n + m);
    // });

    // test.prop([fc.integer({ min: 0, max: 32 }), fc.integer({ min: 0, max: 32 })], {
    //   seed: -1577065471,
    //   path: "0:1:0:0:0:0:2",
    //   endOnFailure: true,
    // })("mult", (n, m) => {
    //   const term = app(mult(), num(n), num(m));
    //   expect(toNumber(term)).toEqual(n * m);
    // });

    // test("mult 2", () => {
    //   const f = fn((y) =>
    //     app(
    //       y,
    //       fn((n) => fnN(2, (f: Term, x: Term) => app(f, app(n, f, x)))),
    //       fnN(2, (f: Term, x: Term) => app(f, x))
    //     )
    //   );
    //   const term1 = fnN(2, (f: Term, x: Term) => app(f, x));
    //   const term = app(f, app(f, term1));
    //   expect(toNumber(term)).toEqual(3);
    // });

    // test("exp", () => {
    //   const term1 = num(5);
    //   const term2 = num(3);
    //   const term = app(exp, term1, term2);
    //   expect(toNumber(term)).toEqual(125);
    // });
    // test("pred", () => {
    //   const term = app(pred, num(5));
    //   expect(toNumber(term)).toEqual(4);
    // });
    // test("sub", () => {
    //   const term1 = num(5);
    //   const term2 = num(3);
    //   const term = app(sub, term1, term2);
    //   expect(toNumber(term)).toEqual(2);
    // });
    // test("div", () => {
    //   const term1 = num(0);
    //   const term2 = num(1);
    //   const term = app(div, term1, term2);
    //   expect(toNumber(term)).toEqual(0);
    // });
    // test("isZero", () => {
    //   const term = app(isZero, num(0));
    //   expect(toBool(term)).toEqual(true);
    // });
    // test("isZero 2", () => {
    //   const term = app(isZero, num(1));
    //   expect(toBool(term)).toEqual(false);
    // });
    // test("isEq", () => {
    //   const term1 = num(5);
    //   const term2 = num(5);
    //   const term = app(isEq, term1, term2);
    //   expect(toBool(term)).toEqual(true);
    // });
    // test("isEq 2", () => {
    //   const term1 = num(5);
    //   const term2 = num(6);
    //   const term = app(isEq, term1, term2);
    //   expect(toBool(term)).toEqual(false);
    // });
    // test("isLess", () => {
    //   const term1 = num(5);
    //   const term2 = num(5);
    //   const term = app(isLess, term1, term2);
    //   expect(toBool(term)).toEqual(false);
    // });
    // test("isLess 2", () => {
    //   const term1 = num(5);
    //   const term2 = num(6);
    //   const term = app(isLess, term1, term2);
    //   expect(toBool(term)).toEqual(true);
    // });
    // test("bool", () => {
    //   const term = bool(true);
    //   expect(toBool(term)).toEqual(true);
    // });
    // test("not", () => {
    //   const term = app(not, bool(true));
    //   expect(toBool(term)).toEqual(false);
    // });
    // test("and", () => {
    //   const term = and(bool(true), bool(false));
    //   expect(toBool(term)).toEqual(false);
    // });
    // test("or", () => {
    //   const term = or(bool(false), bool(true));
    //   expect(toBool(term)).toEqual(true);
    // });
    // test("fib fix", () => {
    //   const ctx = newContext();
    //   const term = app(
    //     fix((self) =>
    //       fn((n) => _if(app(isZero, n), zero, app(add, app(self, app(pred, n)), app(self, app(sub, n, num(2))))))
    //     ),
    //     num(6)
    //   );
    //   expect(toNumber(term)).toEqual(5);
    // });
    // test("sequence", () => {
    //   const term = seq(num(1), num(2), num(3));
    //   expect(toNumber(term)).toEqual(3);
    // });
    // test("let", () => {
    //   const term = _let(num(1), (x) => app(add, x, num(2)));
    //   expect(toNumber(term)).toEqual(3);
    // });
  });

  // describe("handlers", () => {
  //   test("inject", () => {
  //     const handlerId = 1;
  //     const term = inject({
  //       id: handlerId,
  //       handler: fnN(2, (term, cont) => app(cont, term)),
  //       body: handle(handlerId, num(1)),
  //     });
  //     expect(toNumber(term)).toEqual(1);
  //   });

  //   test("inject deep", () => {
  //     const handlerId1 = 1;
  //     const handlerId2 = 2;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => app(cont, num(2))),
  //       body: inject({
  //         id: handlerId2,
  //         handler: fnN(2, (term, cont) => app(cont, num(3))),
  //         body: handle(handlerId1, num(1)),
  //       }),
  //     });
  //     expect(toNumber(term)).toEqual(2);
  //   });

  //   test("inject shadowing", () => {
  //     const handlerId1 = 1;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => app(cont, num(2))),
  //       body: inject({
  //         id: handlerId1,
  //         handler: fnN(2, (term, cont) => app(cont, num(3))),
  //         body: handle(handlerId1, num(1)),
  //       }),
  //     });
  //     expect(toNumber(term)).toEqual(3);
  //   });

  //   test("inject mask", () => {
  //     const handlerId1 = 1;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => app(cont, num(2))),
  //       body: inject({
  //         id: handlerId1,
  //         handler: fnN(2, (term, cont) => app(cont, num(3))),
  //         body: mask(handlerId1, handle(handlerId1, num(1))),
  //       }),
  //     });
  //     expect(toNumber(term)).toEqual(2);
  //   });

  //   test("inject without", () => {
  //     const handlerId1 = 1;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => app(cont, num(2))),
  //       body: inject({
  //         id: handlerId1,
  //         handler: fnN(2, (term, cont) => app(cont, num(3))),
  //         body: without(handlerId1, handle(handlerId1, num(1))),
  //       }),
  //     });
  //     expect(() => toNumber(term)).toThrow();
  //   });

  //   test("inject deep 2", () => {
  //     const handlerId1 = 1;
  //     const handlerId2 = 2;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => app(cont, num(2))),
  //       body: inject({
  //         id: handlerId2,
  //         handler: fnN(2, (term, cont) => app(cont, num(3))),
  //         body: app(add, handle(handlerId1, num(1)), handle(handlerId2, num(1))),
  //       }),
  //     });
  //     expect(toNumber(term)).toEqual(5);
  //   });

  //   test("inject handle twice", () => {
  //     const handlerId = 1;
  //     const term = inject({
  //       id: handlerId,
  //       handler: fnN(2, (term, cont) => app(cont, num(1))),
  //       body: app(add, handle(handlerId, num(1)), handle(handlerId, num(1))),
  //     });
  //     expect(toNumber(term)).toEqual(2);
  //   });

  //   test("inject handle twice seq", () => {
  //     const handlerId = 1;
  //     const term = inject({
  //       id: handlerId,
  //       handler: fnN(2, (term, cont) => app(cont, num(1))),
  //       body: seq(handle(handlerId, num(1)), handle(handlerId, num(1))),
  //     });
  //     expect(toNumber(term)).toEqual(1);
  //   });

  //   test("inject handler no cont", () => {
  //     const handlerId1 = 1;
  //     const term = inject({
  //       id: handlerId1,
  //       handler: fnN(2, (term, cont) => term),
  //       body: app(add, handle(handlerId1, num(1)), num(1)),
  //     });
  //     expect(toNumber(term)).toEqual(1);
  //   });
  // });
}
