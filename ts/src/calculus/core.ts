import { TupleN } from "../types";
import { assert, unreachable } from "../utils";

function clone(e: Term): Term {
  // Rename all binders with fresh ids
  const rename = (m: Map<number, number>, e: Term): Term => {
    switch (e.type) {
      case "var": {
        return { type: "var", id: m.get(e.id) ?? e.id };
      }
      case "fn": {
        const i = nextId();
        return {
          type: "fn",
          id: i,
          body: rename(new Map(m).set(e.id, i), e.body),
        };
      }
      case "app": {
        return { type: "app", func: rename(m, e.func), arg: rename(m, e.arg) };
      }
      case "inject": {
        return {
          type: "inject",
          id: e.id,
          handler: rename(m, e.handler),
          return: rename(m, e.return),
          body: rename(m, e.body),
        };
      }
      case "handle": {
        return { type: "handle", id: e.id, value: rename(m, e.value), cont: rename(m, e.cont) };
      }

      default:
        unreachable("unhandled case");
    }
  };

  // Rename only terms that include binders
  const rename_binders = (e: Term): Term | undefined => {
    switch (e.type) {
      case "var":
        return undefined;
      case "fn":
        return rename(new Map(), e);
      case "app": {
        const func = rename_binders(e.func);
        const arg = rename_binders(e.arg);
        if (!func && !arg) return undefined;

        const term = { ...e };
        if (func) term.func = func;
        if (arg) term.arg = arg;
        return term;
      }
      case "inject": {
        const handler = rename_binders(e.handler);
        const return_ = rename_binders(e.return);
        const body = rename_binders(e.body);
        if (!handler && !return_ && !body) return undefined;

        const term = { ...e };
        if (handler) term.handler = handler;
        if (return_) term.return = return_;
        if (body) term.body = body;
        return term;
      }
      case "handle": {
        const value = rename_binders(e.value);
        const cont = rename_binders(e.cont);
        if (!value && !cont) return undefined;

        const term = { ...e };
        if (value) term.value = value;
        if (cont) term.cont = cont;
        return term;
      }
      default:
        unreachable("unhandled case");
    }
  };

  return rename_binders(e) ?? e;
}

function subst(id: number, arg: Term, e: Term): Term {
  const go = (e: Term): Term => {
    switch (e.type) {
      case "var": {
        return e.id === id ? clone(arg) : e;
      }
      case "fn": {
        // If the id to substitute is bound in this lambda, we stop.
        if (e.id === id) return e;
        return { type: "fn", id: e.id, body: go(e.body) };
      }
      case "app": {
        return { type: "app", func: go(e.func), arg: go(e.arg) };
      }
      case "inject": {
        return {
          type: "inject",
          id: e.id,
          handler: go(e.handler),
          return: go(e.return),
          body: go(e.body),
        };
      }
      case "handle": {
        return { type: "handle", id: e.id, value: go(e.value), cont: go(e.cont) };
      }
      default:
        unreachable("unhandled case");
    }
  };
  return go(e);
}

/**
 * Evaluation
 */

const propagateHandles = (e: Term): Term => {
  switch (e.type) {
    case "var":
      return e;
    case "fn":
      return e;
    case "app": {
      const func = propagateHandles(e.func);
      const arg = propagateHandles(e.arg);
      if (func.type === "handle") {
        const cont = func.cont;
        assert(cont.type === "fn");
        return { ...func, cont: fn((result) => app(cont, app(result(), arg))) };
      }
      if (arg.type === "handle") {
        const cont = arg.cont;
        assert(cont.type === "fn");
        return { ...arg, cont: fn((result) => app(cont, app(func, result()))) };
      }
      return { type: "app", func, arg };
    }
    case "inject": {
      const handler = propagateHandles(e.handler);
      const body = propagateHandles(e.body);
      const _return = propagateHandles(e.return);
      if (handler.type === "handle") {
        const cont = handler.cont;
        assert(cont.type === "fn");
        return { ...handler, cont: fn((result) => app(cont, { ...e, handler: result() })) };
      }
      if (body.type === "handle") {
        const cont = body.cont;
        assert(cont.type === "fn");
        return { ...body, cont: fn((result) => app(cont, { ...e, body: result() })) };
      }
      if (_return.type === "handle" && _return.id !== e.id) {
        const cont = _return.cont;
        assert(cont.type === "fn");
        return { ..._return, cont: fn((result) => app(cont, { ...e, return: result() })) };
      }
      return e;
    }
    default:
      unreachable("unhandled case");
  }
};

function eval_(e: Term): Term {
  switch (e.type) {
    case "var":
      return e;
    case "fn":
      return e;
    case "app": {
      const func = eval_(e.func);
      const arg = eval_(e.arg);
      e = { ...e, func, arg };

      switch (func.type) {
        case "fn":
          return eval_(subst(func.id, arg, func.body));
        default:
          return e;
      }
    }
    case "inject": {
      const handler = eval_(e.handler);
      const return_ = eval_(e.return);
      const body = eval_(propagateHandles(e.body));
      e = { ...e, handler, return: return_, body };

      if (body.type === "handle") {
        if (e.id !== body.id) {
          return { ...body, cont: fn((result) => ({ ...e, body: app(body.cont, result()) })) };
        }

        if (handler.type !== "fn") return e;
        const app1 = eval_(subst(handler.id, body, handler.body));

        if (app1.type !== "fn") return e;
        const cont = fn((result) => ({ ...e, body: app(body.cont, result()) }));
        return eval_(subst(app1.id, cont, app1.body));
      }

      if (return_.type !== "fn") return e;
      return eval_(subst(return_.id, body, return_.body));
    }
    case "handle": {
      return { ...e, value: eval_(e.value) };
    }
    default:
      unreachable("unhandled case");
  }
}

function stringify(e: Term): string {
  const go = (e: Term): string => {
    switch (e.type) {
      case "var":
        return `#${e.id}`;
      case "app":
        return `(${go(e.func)}) ${go(e.arg)}`;
      case "fn":
        return `fn #${e.id} -> ${go(e.body)}`;
      case "inject": {
        unreachable("todo");
      }
      case "handle": {
        unreachable("todo");
      }
      default:
        unreachable("unhandled case");
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
function normalise(e: Term): Term {
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
    case "inject": {
      return {
        ...e,
        handler: normalise(e.handler),
        return: normalise(e.return),
        body: normalise(e.body),
      };
    }
    case "handle": {
      return {
        ...e,
        value: normalise(e.value),
        cont: normalise(e.cont),
      };
    }
    default:
      unreachable("unhandled case");
  }
}

const _eval = normalise;

type Lambda =
  | { type: "var"; id: number }
  | { type: "app"; func: Term; arg: Term }
  | { type: "fn"; id: number; body: Term };
type Handlers =
  | { type: "inject"; id: number; handler: Term; return: Term; body: Term }
  | { type: "handle"; id: number; value: Term; cont: Term };
// | { type: "mask"; id: number; body: Term };
type Process =
  | { type: "channel"; sender: Term; receiver: Term }
  | { type: "send"; id: number; value: Term; rest: Term }
  | { type: "receive"; ids: number[] };
// type Term = Lambda | Handlers | Process;
type Term = Lambda | Handlers;
// type Term = Lambda;

let id = 0;
const nextId = () => id++;

const name = (id = nextId()) => ({ type: "var", id } satisfies Term);
const _app = (func: Term, arg: Term) => ({ type: "app", func, arg } satisfies Term);
const app = (func: Term, ...[head, ...rest]: Term[]) =>
  rest.length === 0 ? _app(func, head) : (app(_app(func, head), ...rest) satisfies Term);
const fn = (body: (term: () => Term) => Term) => {
  const id = nextId();
  return { type: "fn", id, body: body(() => name(id)) } satisfies Term;
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
const handle = (id: number, value: Term, cont = fn((term) => term())) =>
  ({ type: "handle", id, value, cont } satisfies Term);
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
const div = () =>
  fix((self) => fnN(2, (x, y) => _if(app(isZero(), x()), zero(), app(succ(), app(self(), app(sub(), x(), y()), y())))));
const isZero = () =>
  fn((n) =>
    app(
      n(),
      fn((x) => bool(false)),
      bool(true)
    )
  );
const isEq = () =>
  fix((self) =>
    fnN(2, (x, y) =>
      app(
        numToEnum(x()),
        fn((predX) =>
          app(
            numToEnum(y()),
            fn((predY) => app(self(), predX(), predY())),
            bool(false)
          )
        ),
        app(isZero(), y())
      )
    )
  );
const isLess = () =>
  fix((self) =>
    fnN(2, (x, y) =>
      app(
        numToEnum(x()),
        fn((predX) =>
          app(
            numToEnum(y()),
            fn((predY) => app(self(), predX(), predY())),
            bool(false)
          )
        ),
        app(not(), app(isZero(), y()))
      )
    )
  );

const bool = (b: boolean) => (b ? fnN(2, (x, y) => x()) : fnN(2, (x, y) => y()));
const not = () => fn((x) => app(x(), bool(false), bool(true)));
const and = () => fnN(2, (x, y) => app(x(), y(), bool(false)));
const or = () => fnN(2, (x, y) => app(x(), bool(true), y()));
const _if = (cond: Term, then: Term, _else: Term) =>
  app(
    cond,
    fn(() => then),
    fn(() => _else),
    bool(true)
  );

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

    test("either 2", () => {
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

    test.prop([fc.integer({ min: 0, max: 128 })])("count", (n) => {
      const term1 = num(n);
      expect(toNumber(term1)).toEqual(n);
    });

    test.prop([fc.integer({ min: 0, max: 128 })])("count succ", (n) => {
      const term1 = num(n);
      const term = app(succ(), term1);
      expect(toNumber(term)).toEqual(n + 1);
    });

    test.prop([fc.integer({ min: 0, max: 64 }), fc.integer({ min: 0, max: 64 })])("add", (n, m) => {
      const term1 = num(n);
      const term2 = num(m);
      const term = app(add(), term1, term2);
      expect(toNumber(term)).toEqual(n + m);
    });

    test.prop([fc.integer({ min: 0, max: 16 }), fc.integer({ min: 0, max: 16 })])("mult", (n, m) => {
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

    test.prop([fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 })])("exp", (n, m) => {
      const term = app(exp(), num(n), num(m));
      expect(toNumber(term)).toEqual(n ** m);
    });

    test.prop([fc.integer({ min: 1, max: 64 })])("pred", (n) => {
      const term = app(pred(), num(n));
      expect(toNumber(term)).toEqual(n - 1);
    });

    test.prop([fc.integer({ min: 0, max: 32 }).chain((n) => fc.integer({ min: 0, max: n }).map((m) => [n, m]))])(
      "sub",
      ([n, m]) => {
        const term = app(sub(), num(n), num(m));
        expect(toNumber(term)).toEqual(n - m);
      }
    );

    test.prop([fc.integer({ min: 1, max: 4 }).chain((n) => fc.integer({ min: 1, max: n }).map((m) => [n * m, m]))])(
      "div",
      ([n, m]) => {
        const term = app(div(), num(n), num(m));
        expect(toNumber(term)).toEqual(n / m);
      }
    );

    test.prop([fc.integer({ min: 0, max: 96 })])("isZero", (n) => {
      const term = app(isZero(), num(n));
      expect(toBool(term)).toEqual(n === 0);
    });

    test.prop([fc.integer({ min: 0, max: 32 }), fc.integer({ min: 0, max: 32 })])("isEq", (n, m) => {
      const term = app(isEq(), num(n), num(m));
      expect(toBool(term)).toEqual(n === m);
    });

    test.prop([fc.integer({ min: 0, max: 32 }), fc.integer({ min: 0, max: 32 })])("isLess", (n, m) => {
      const term = app(isLess(), num(n), num(m));
      expect(toBool(term)).toEqual(n < m);
    });

    test.prop([fc.boolean()])("bool", (b) => {
      const term = bool(b);
      expect(toBool(term)).toEqual(b);
    });

    test.prop([fc.boolean()])("not", (b) => {
      const term = app(not(), bool(b));
      expect(toBool(term)).toEqual(!b);
    });

    test.prop([fc.boolean()])("double not", (b) => {
      const term = app(not(), app(not(), bool(b)));
      expect(toBool(term)).toEqual(b);
    });

    test.prop([fc.boolean(), fc.boolean()])("and", (b1, b2) => {
      const term = app(and(), bool(b1), bool(b2));
      expect(toBool(term)).toEqual(b1 && b2);
    });

    test.prop([fc.boolean(), fc.boolean()])("or", (b1, b2) => {
      const term = app(or(), bool(b1), bool(b2));
      expect(toBool(term)).toEqual(b1 || b2);
    });

    test("fib fix", () => {
      const term = app(
        fix((self) =>
          fn((n) =>
            _if(
              app(isZero(), n()),
              num(1),
              app(add(), app(self(), app(pred(), n())), app(self(), app(sub(), n(), num(2))))
            )
          )
        ),
        num(6)
      );
      expect(toNumber(term)).toEqual(21);
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

  describe("handlers", () => {
    test.only("inject", () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) => app(cont(), term())),
        body: handle(handlerId, num(1)),
      });
      expect(toNumber(term)).toEqual(1);
    });

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
  });
}
