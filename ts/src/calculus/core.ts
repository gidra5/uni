import { TupleN } from "../types";
import { assert, unreachable } from "../utils";

function clone(e: Lambda): Lambda {
  // Rename all binders with fresh ids
  const rename = (m: Map<number, number>, e: Lambda): Lambda => {
    switch (e.type) {
      case "var":
        return { type: "var", id: m.get(e.id) ?? e.id };
      case "fn":
        const i = nextId();
        return {
          type: "fn",
          id: i,
          body: rename(new Map(m).set(e.id, i), e.body),
        };
      case "app":
        return { type: "app", func: rename(m, e.func), arg: rename(m, e.arg) };
    }
  };

  // Rename only terms that include binders
  const rename_binders = (e: Lambda): Lambda | undefined => {
    switch (e.type) {
      case "var":
        return undefined;
      case "fn":
        return rename(new Map(), e);
      case "app": {
        const head = rename_binders(e.func);
        const arg = rename_binders(e.arg);
        if (head && arg) return { type: "app", func: head, arg };
        if (head) return { type: "app", func: head, arg: e.arg };
        if (arg) return { type: "app", func: e.func, arg };
        return undefined;
      }
    }
  };
  return rename_binders(e) ?? e;
}

function subst(id: number, arg: Lambda, e: Lambda): Lambda {
  const go = (e: Lambda): Lambda => {
    switch (e.type) {
      case "var":
        return e.id === id ? clone(arg) : e;
      case "fn":
        // If the id to substitute is bound in this lambda, we stop.
        if (e.id === id) return e;
        return { type: "fn", id: e.id, body: go(e.body) };
      case "app":
        return { type: "app", func: go(e.func), arg: go(e.arg) };
    }
  };
  return go(e);
}

/**
 * Evaluation
 */

function eval_(e: Lambda): Lambda {
  switch (e.type) {
    case "var":
      return e;
    case "fn":
      return e;
    case "app": {
      const head = eval_(e.func);
      const arg = eval_(e.arg);
      switch (head.type) {
        case "fn":
          return eval_(subst(head.id, arg, head.body));
        default:
          return { type: "app", func: head, arg };
      }
    }
  }
}

function stringify(e: Lambda): string {
  const go = (e: Lambda): string => {
    switch (e.type) {
      case "var":
        return `#${e.id}`;
      case "app":
        return `(${go(e.func)}) ${go(e.arg)}`;
      case "fn":
        return `fn #${e.id} -> ${go(e.body)}`;
    }
  };
  return go(e);
}

/**
 * Normalisation
 */

/**
 * Fully normalise an expression, including under binders.
 */
function normalise(e: Lambda): Lambda {
  switch (e.type) {
    case "var":
      return e;
    case "fn":
      return { type: "fn", id: e.id, body: normalise(e.body) };
    case "app": {
      const head = eval_(e.func);
      switch (head.type) {
        case "fn":
          return normalise(subst(head.id, normalise(e.arg), head.body));
        default:
          return { type: "app", func: head, arg: normalise(e.arg) };
      }
    }
  }
}

const _eval = normalise;

export type Lambda =
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
// const inject = (x: { id?: number; handler: Term; return?: Term; body: Term }) => {
//   const { id = nextId(), return: ret = fn((term) => term()) } = x;
//   return { type: "inject", ...x, id, return: ret } satisfies Term;
// };
// const handle = (id: number, value: Term) => ({ type: "handle", id, value } satisfies Term);
// const mask = (id: number, body: Term) => ({ type: "mask", id, body } satisfies Term);
// const without = (id: number, body: Term) => inject({ id, handler: fn(() => unreachable("effect forbidden")), body });

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

const fix = (f: (self: () => Term) => Term) =>
  app(
    fn((x) => app(x(), x())),
    fn((self) => f(() => app(self(), self())))
  );

const zero = () => fnN(2, (f, x) => x());
const succ = () => fn((n) => fnN(2, (f, x) => app(f(), app(n(), f(), x()))));
const add = () => fnN(2, (x, y) => app(y(), succ(), x()));
const mult = () => fnN(2, (x, y) => app(y(), app(add(), x()), zero()));
const exp = () => fnN(2, (x, y) => app(y(), app(mult(), x()), app(succ(), zero())));
const num = (n: number) => (n === 0 ? zero() : app(succ(), num(n - 1)));
const enumZero = () => fnN(2, (s, z) => z());
const enumSucc = () => fn((n) => fnN(2, (s, z) => app(s(), n())));
const numToEnum = (n: Term) => app(n, enumSucc(), enumZero());
const enumNumToNum = () =>
  fix((self) =>
    fn((n) =>
      app(
        n(),
        fn((n) => app(succ(), app(self(), n()))),
        zero()
      )
    )
  );
const pred = () =>
  fn((n) =>
    app(
      enumNumToNum(),
      app(
        numToEnum(n()),
        fn((pred) => pred()),
        enumZero()
      )
    )
  );
const sub = () => fnN(2, (x, y) => app(y(), pred(), x()));
const div = () => fnN(2, (x, y) => _if(app(isZero(), x()), zero(), app(succ(), app(div(), app(sub(), x(), y()), y()))));
const isZero = () =>
  fn((n) =>
    app(
      n(),
      fn((x) => bool(false)),
      bool(true)
    )
  );
const isEq = () =>
  fnN(2, (x, y) =>
    app(
      numToEnum(x()),
      fn((predX) =>
        app(
          numToEnum(y()),
          fn((predY) => app(isEq(), predX(), predY())),
          bool(false)
        )
      ),
      app(isZero(), y())
    )
  );
const isLess = () =>
  fnN(2, (x, y) =>
    app(
      numToEnum(x()),
      fn((predX) =>
        app(
          numToEnum(y()),
          fn((predY) => app(isLess(), predX(), predY())),
          bool(false)
        )
      ),
      app(not(), app(isZero(), y()))
    )
  );

const bool = (b: boolean) => (b ? fnN(2, (x, y) => x()) : fnN(2, (x, y) => y()));
const not = () => fn((x) => app(x(), bool(false), bool(true)));
const and = (x: Term, y: Term) => app(x, y, bool(false));
const or = (x: Term, y: Term) => app(x, bool(true), y);
const _if = (cond: Term, then: Term, _else: Term) => app(cond, then, _else);

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
const _toBool = (b: Term) => {
  assert(b.type === "fn");
  const body = b.body;
  const xId = b.id;

  assert(body.type === "fn");
  let bodyBody = body.body;
  const yId = body.id;

  assert(bodyBody.type === "var");
  if (bodyBody.id === xId) return true;
  else if (bodyBody.id === yId) return false;

  unreachable("toBool failed");
};
const toBool = (b: Term) => {
  return _toBool(_eval(b));
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
      // const ctx = newContext();
      const value = name(0);
      const term = app(
        fn((x) => x()),
        value
      );
      // expect(_eval(term, ctx)).toEqual(value);
      expect(_eval(term)).toEqual(value);
    });

    test("tuple", () => {
      // const ctx = newContext();
      const value1 = name();
      const value2 = name();
      const term = app(
        tuple(value1, value2),
        fnN(2, (x, y) => y())
      );
      // expect(_eval(term, ctx)).toEqual(value2);
      expect(_eval(term)).toEqual(value2);
    });

    test("either", () => {
      // const ctx = newContext();
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
      // expect(_eval(term, ctx)).toEqual(value1);
      expect(_eval(term)).toEqual(value1);
    });

    test.todo("either2", () => {
      // const ctx = newContext();
      const value1 = name();
      const term = app(
        fn((x) => fnN(2, (a) => app(a(), x()))),
        value1
      );
      // expect(_eval(term, ctx)).toEqual(fnN(2, (a) => app(a(), value1)));
      expect(_eval(term)).toEqual(fnN(2, (a) => app(a(), value1)));
    });

    test("either3", () => {
      // const ctx = newContext();
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
      // expect(_eval(term, ctx)).toEqual(value1);
      expect(_eval(term)).toEqual(value1);
    });

    test("count zero", () => {
      expect(toNumber(zero())).toEqual(0);
    });

    test.prop([fc.integer({ min: 0, max: 1024 })])("count", (n) => {
      const term1 = num(n);
      expect(toNumber(term1)).toEqual(n);
    });

    test.prop([fc.integer({ min: 0, max: 1024 })])("count succ", (n) => {
      const term1 = num(n);
      const term = app(succ(), term1);
      expect(toNumber(term)).toEqual(n + 1);
    });

    test.prop([fc.integer({ min: 0, max: 128 }), fc.integer({ min: 0, max: 128 })])("add", (n, m) => {
      const term1 = num(n);
      const term2 = num(m);
      const term = app(add(), term1, term2);
      expect(toNumber(term)).toEqual(n + m);
    });

    test.prop([fc.integer({ min: 0, max: 24 }), fc.integer({ min: 0, max: 24 })])("mult", (n, m) => {
      const term = app(mult(), num(n), num(m));
      expect(toNumber(term)).toEqual(n * m);
    });

    test("mult 2", () => {
      const f = fn((y) =>
        app(
          y(),
          fn((n) => fnN(2, (f, x) => app(f(), app(n(), f(), x())))),
          fnN(2, (f, x) => app(f(), x()))
        )
      );
      const term1 = fnN(2, (f, x) => app(f(), x()));
      const term = app(f, app(f, term1));
      expect(toNumber(term)).toEqual(3);
    });

    test.prop([fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 4 })])("exp", (n, m) => {
      const term = app(exp(), num(n), num(m));
      expect(toNumber(term)).toEqual(n ** m);
    });

    test.only.prop([fc.integer({ min: 1, max: 5 })], { seed: -1455889466, path: "0:1:0", endOnFailure: true })(
      "pred",
      (n) => {
        const term = app(pred(), num(n));
        expect(toNumber(term)).toEqual(n - 1);
      }
    );

    test.todo("pred", () => {
      const term = app(pred(), num(5));
      expect(toNumber(term)).toEqual(4);
    });

    test.todo("sub", () => {
      const term1 = num(5);
      const term2 = num(3);
      const term = app(sub(), term1, term2);
      expect(toNumber(term)).toEqual(2);
    });
    test.todo("div", () => {
      const term1 = num(0);
      const term2 = num(1);
      const term = app(div(), term1, term2);
      expect(toNumber(term)).toEqual(0);
    });

    test("isZero", () => {
      const term = app(isZero(), num(0));
      expect(toBool(term)).toEqual(true);
    });
    test("isZero 2", () => {
      const term = app(isZero(), num(1));
      expect(toBool(term)).toEqual(false);
    });

    test.todo("isEq", () => {
      const term1 = num(5);
      const term2 = num(5);
      const term = app(isEq(), term1, term2);
      expect(toBool(term)).toEqual(true);
    });
    test.todo("isEq 2", () => {
      const term1 = num(5);
      const term2 = num(6);
      const term = app(isEq(), term1, term2);
      expect(toBool(term)).toEqual(false);
    });
    test.todo("isLess", () => {
      const term1 = num(5);
      const term2 = num(5);
      const term = app(isLess(), term1, term2);
      expect(toBool(term)).toEqual(false);
    });
    test.todo("isLess 2", () => {
      const term1 = num(5);
      const term2 = num(6);
      const term = app(isLess(), term1, term2);
      expect(toBool(term)).toEqual(true);
    });

    test("bool", () => {
      const term = bool(true);
      expect(toBool(term)).toEqual(true);
    });

    test("not", () => {
      const term = app(not(), bool(true));
      expect(toBool(term)).toEqual(false);
    });

    test("not 2", () => {
      const term = app(not(), bool(false));
      expect(toBool(term)).toEqual(true);
    });

    test("not 3", () => {
      const term = app(not(), app(not(), bool(false)));
      expect(toBool(term)).toEqual(false);
    });

    test("and", () => {
      const term = and(bool(true), bool(false));
      expect(toBool(term)).toEqual(false);
    });

    test("or", () => {
      const term = or(bool(false), bool(true));
      expect(toBool(term)).toEqual(true);
    });

    test.todo("fib fix", () => {
      // const ctx = newContext();
      const term = app(
        fix((self) =>
          fn((n) =>
            _if(
              app(isZero(), n()),
              zero(),
              app(add(), app(self(), app(pred(), n())), app(self(), app(sub(), n(), num(2))))
            )
          )
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
      const term = _let(num(1), (x) => app(add(), x(), num(2)));
      expect(toNumber(term)).toEqual(3);
    });
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
