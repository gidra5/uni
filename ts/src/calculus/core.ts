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
      return { type: "fn", id: e.id, body: propagateHandles(e.body) };
    case "app": {
      const func = propagateHandles(e.func);
      const arg = propagateHandles(e.arg);
      // console.dir([7, func, arg], { depth: null });
      if (func.type === "handle") {
        const cont = func.cont;
        assert(cont.type === "fn");
        return { ...func, cont: fn((result) => app(app(cont, result()), arg)) };
      }
      if (arg.type === "handle") {
        const cont = arg.cont;
        assert(cont.type === "fn");
        return { ...arg, cont: fn((result) => app(func, app(cont, result()))) };
      }
      return { type: "app", func, arg };
    }
    case "inject": {
      const handler = propagateHandles(e.handler);
      const body = propagateHandles(e.body);
      const _return = propagateHandles(e.return);
      e = { ...e, handler, return: _return, body };

      if (handler.type === "handle") {
        const cont = handler.cont;
        assert(cont.type === "fn");
        return { ...handler, cont: fn((result) => ({ ...e, handler: app(cont, result()) })) };
      }
      if (body.type === "handle" && body.id !== e.id) {
        const cont = body.cont;
        assert(cont.type === "fn");
        return { ...body, cont: fn((result) => ({ ...e, body: app(cont, result()) })) };
      }
      if (_return.type === "handle") {
        const cont = _return.cont;
        assert(cont.type === "fn");
        return { ..._return, cont: fn((result) => ({ ...e, return: app(cont, result()) })) };
      }
      return e;
    }
    case "handle": {
      const value = propagateHandles(e.value);
      assert(e.cont.type === "fn");
      if (value.type === "handle") {
        const cont = value.cont;
        assert(cont.type === "fn");
        return { ...value, cont: fn((result) => ({ ...e, value: app(cont, result()) })) };
      }
      return { ...e, value };
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
      if (handler.type !== "fn") return e;
      if (return_.type !== "fn") return e;

      if (body.type === "handle") {
        if (e.id !== body.id) {
          return { ...body, cont: fn((result) => ({ ...e, body: app(body.cont, result()) })) };
        }

        const app1 = eval_(subst(handler.id, body.value, handler.body));
        if (app1.type !== "fn") return e;

        const cont = fn((result) => ({ ...e, body: app(body.cont, result()) }));
        return eval_(subst(app1.id, cont, app1.body));
      }

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
        return `(${go(e.func)}) (${go(e.arg)})`;
      case "fn":
        return `fn #${e.id} -> ${go(e.body)}`;
      case "inject": {
        return `inject #${e.id} (${go(e.handler)}) ([return]: ${go(e.return)}) (${go(e.body)})`;
      }
      case "handle": {
        return `handle #${e.id} (${go(e.value)})`;
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
  // console.dir({ e }, { depth: null });
  e = propagateHandles(e);
  // console.dir({ e2: e }, { depth: null });
  switch (e.type) {
    case "var":
      return e;
    case "fn":
      return { type: "fn", id: e.id, body: normalise(e.body) };
    case "app": {
      const arg = normalise(e.arg);
      const func = eval_(e.func);
      e = propagateHandles({ ...e, func, arg });

      if (e.type === "handle") return normalise(e);
      switch (func.type) {
        case "fn":
          return normalise(subst(func.id, arg, func.body));
        default:
          return { type: "app", func: func, arg: arg };
      }
    }
    case "inject": {
      const body = normalise(e.body);
      const return_ = normalise(e.return);
      const handler = normalise(e.handler);
      e = propagateHandles({ ...e, handler, return: return_, body });

      if (e.type === "handle") return normalise(e);
      if (return_.type !== "fn") {
        return e;
      }

      if (handler.type !== "fn") {
        return e;
      }

      // console.dir([1, e], { depth: null });

      if (body.type === "handle") {
        if (e.id !== body.id) {
          return normalise({ ...body, cont: fn((result) => ({ ...e, body: normalise(app(body.cont, result())) })) });
        }

        const app1 = normalise(subst(handler.id, body.value, handler.body));

        if (app1.type !== "fn") {
          return {
            ...e,
            handler: handler,
            return: return_,
            body: body,
          };
        }

        const cont = normalise(fn((result) => ({ ...e, body: normalise(app(body.cont, result())) })));
        // console.dir([4, cont], { depth: null });
        // console.dir([5, app1], { depth: null });
        const x = normalise(subst(app1.id, cont, app1.body));
        // console.dir([3, x], { depth: null });
        return x;
      }

      const x = normalise(subst(return_.id, body, return_.body));
      // console.dir([2, x], { depth: null });
      return x;
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
// | { type: "without"; id: number; body: Term };
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
// const without = (id: number, body: Term) => ({ type: "without", id, body } satisfies Term);

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

const listCons = () => fnN(2, (xs, x) => fnN(2, (cons, nil) => app(cons(), x(), xs())));
const listNil = () => fnN(2, (cons, nil) => nil());

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
const _toTuple = (t: Term) => {
  // console.dir({ t2: t }, { depth: null });

  const tuple: Term[] = [];
  assert(t.type === "fn");
  let body = t.body;
  const fnId = t.id;

  while (true) {
    if (body.type === "var" && body.id === fnId) {
      return tuple;
    }
    assert(body.type === "app");
    tuple.unshift(body.arg);
    body = body.func;
  }
};
const toTuple = (t: Term) => {
  return _toTuple(_eval(t));
};

const toList = (t: Term) => {
  // console.dir({ t1: t }, { depth: null });

  let _t = _eval(t);
  const list: Term[] = [];
  while (true) {
    const term = app(
      _t,
      fnN(2, (x, rest) => tuple(bool(true), x(), rest())),
      tuple(bool(false), listNil(), listNil())
    );
    const [result, value, rest] = toTuple(term);
    // console.dir({ result, value, rest, resultBool: toBool(result) }, { depth: null });
    if (toBool(result)) {
      list.push(value);
      _t = rest;
    } else {
      return list;
    }
  }
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
    test("inject", () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) => app(cont(), term())),
        body: handle(handlerId, num(1)),
      });

      expect(toNumber(term)).toEqual(1);
    });

    test("inject deep", () => {
      const handlerId1 = 1;
      const handlerId2 = 2;
      const term = inject({
        id: handlerId1,
        handler: fnN(2, (term, cont) => app(cont(), num(2))),
        body: inject({
          id: handlerId2,
          handler: fnN(2, (term, cont) => app(cont(), num(3))),
          body: handle(handlerId1, num(1)),
        }),
      });
      expect(toNumber(term)).toEqual(2);
    });

    test("inject shadowing", () => {
      const handlerId1 = 1;
      const term = inject({
        id: handlerId1,
        handler: fnN(2, (term, cont) => app(cont(), num(2))),
        body: inject({
          id: handlerId1,
          handler: fnN(2, (term, cont) => app(cont(), num(3))),
          body: handle(handlerId1, num(1)),
        }),
      });
      expect(toNumber(term)).toEqual(3);
    });

    // test.todo("inject mask", () => {
    //   const handlerId1 = 1;
    //   const term = inject({
    //     id: handlerId1,
    //     handler: fnN(2, (term, cont) => app(cont(), num(2))),
    //     body: inject({
    //       id: handlerId1,
    //       handler: fnN(2, (term, cont) => app(cont(), num(3))),
    //       body: mask(handlerId1, handle(handlerId1, num(1))),
    //     }),
    //   });
    //   expect(toNumber(term)).toEqual(2);
    // });

    // test.todo("inject without", () => {
    //   const handlerId1 = 1;
    //   const term = inject({
    //     id: handlerId1,
    //     handler: fnN(2, (term, cont) => app(cont(), num(2))),
    //     body: inject({
    //       id: handlerId1,
    //       handler: fnN(2, (term, cont) => app(cont(), num(3))),
    //       body: without(handlerId1, handle(handlerId1, num(1))),
    //     }),
    //   });
    //   expect(() => toNumber(term)).toThrow();
    // });

    test("inject deep 2", () => {
      const handlerId1 = 1;
      const handlerId2 = 2;
      const term = inject({
        id: handlerId1,
        handler: fnN(2, (term, cont) => app(cont(), _eval(num(2)))),
        body: inject({
          id: handlerId2,
          handler: fnN(2, (term, cont) => app(cont(), _eval(num(3)))),
          body: app(
            add(),
            handle(
              handlerId1,
              fn((x) => x())
            ),
            handle(
              handlerId2,
              fn((x) => x())
            )
          ),
        }),
      });
      expect(toNumber(term)).toEqual(5);
    });

    test("inject handle twice", () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) => app(cont(), term())),
        body: app(_eval(add()), handle(handlerId, _eval(num(1))), handle(handlerId, _eval(num(2)))),
      });
      expect(toNumber(term)).toEqual(3);
    });

    test("inject handle twice seq", () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) => app(cont(), num(2))),
        body: seq(handle(handlerId, num(1)), handle(handlerId, num(3))),
      });
      expect(toNumber(term)).toEqual(2);
    });

    test("inject handle twice seq 2", () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) => app(cont(), term())),
        body: seq(handle(handlerId, num(1)), handle(handlerId, num(3))),
      });
      expect(toNumber(term)).toEqual(3);
    });

    test("inject handler no cont", () => {
      const handlerId1 = 1;
      const term = inject({
        id: handlerId1,
        handler: fnN(2, (term, cont) => term()),
        body: app(
          fnN(2, (x, y) => y()),
          handle(handlerId1, _eval(num(1))),
          _eval(num(2))
        ),
      });
      expect(toNumber(term)).toEqual(1);
    });

    test("multiple continuation calls", async () => {
      const handlerId1 = 1;
      const term = inject({
        id: handlerId1,
        handler: fnN(2, (term, cont) => _let(app(cont(), bool(true)), (x) => tuple(x(), app(cont(), bool(false))))),
        body: _if(handle(handlerId1, _eval(num(1))), num(2), num(3)),
      });
      expect(toTuple(term).map(toNumber)).toEqual([2, 3]);
    });

    // it("pythagorean triple example", async () => {
    //   const input = `
    //     import "std/math" as { floor, sqrt }

    //     decide := :decide |> handle
    //     fail := :fail |> handle
    //     choose_int := fn (m, n) {
    //       if m > n do fail()
    //       if decide() do m else self(m+1, n)
    //     }

    //     pythagorean_triple := fn m, n {
    //       a := choose_int(m, n);
    //       b := choose_int(a + 1, n + 1);
    //       c := sqrt (a^2 + b^2);
    //       if floor c != c do fail()

    //       (a, b, c)
    //     };

    //     false_branch_first :=
    //       decide: handler fn (callback, _) {
    //         fail_handler := fail: handler fn do callback false
    //         inject fail_handler { callback true }
    //       };
    //     true_branch_first :=
    //       decide: handler fn (callback, _) {
    //         fail_handler := fail: handler fn do callback true
    //         inject fail_handler { callback false }
    //       };

    //     inject false_branch_first { pythagorean_triple 4 15 },
    //     inject true_branch_first { pythagorean_triple 4 15 }
    //   `;
    //   const result = await evaluate(input);
    //   expect(result).toStrictEqual([
    //     [5, 12, 13],
    //     [12, 16, 20],
    //   ]);
    // });

    test("logger example 2", async () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) =>
          _let(app(cont(), term()), (res) =>
            app(
              res(),
              fnN(2, (result, logs) => tuple(result(), app(listCons(), logs(), term())))
            )
          )
        ),
        return: fn((x) => tuple(x(), listNil())),
        body: tuple(
          _eval(num(1)),
          app(
            fn((x) => handle(handlerId, x())),
            _eval(num(1))
          )
        ),
      });

      const x = toTuple(term);
      const [result, logs] = x;

      const [log3] = toList(logs);

      expect(toNumber(log3)).toEqual(1);

      const result1 = toTuple(result);
      const [a, b] = result1;
      const a1 = toNumber(a);
      const b1 = toNumber(b);
      expect(a1).toEqual(1);
      expect(b1).toEqual(1);
    });

    test("logger example", async () => {
      const handlerId = 1;
      const term = inject({
        id: handlerId,
        handler: fnN(2, (term, cont) =>
          _let(app(cont(), term()), (res) =>
            app(
              res(),
              fnN(2, (result, logs) => tuple(result(), app(listCons(), logs(), term())))
            )
          )
        ),
        return: fn((x) => tuple(x(), listNil())),
        body: seq(
          handle(handlerId, _eval(num(1))),
          handle(handlerId, _eval(num(2))),
          tuple(
            _eval(num(3)),
            app(
              fn((x) => handle(handlerId, _eval(tuple(num(4), x())))),
              _eval(num(5))
            )
          )
        ),
      });
      const x = toTuple(term);
      const [result, logs] = x;

      const [log1, log2, log3] = toList(logs);

      expect(toNumber(log1)).toEqual(1);
      expect(toNumber(log2)).toEqual(2);
      expect(toTuple(log3).map(toNumber)).toEqual([4, 5]);

      const result1 = toTuple(result);
      const [a, b] = result1;
      const a1 = toNumber(a);
      const b1 = toTuple(b);
      expect(a1).toEqual(3);
      expect(b1.map(toNumber)).toEqual([4, 5]);
    });

    test("state example 2", async () => {
      const handlerStateId = 1;
      const term = app(
        inject({
          id: handlerStateId,
          handler: _eval(
            fnN(2, (term, cont) =>
              app(
                term(),
                fnN(2, (action, term) =>
                  _if(
                    app(isZero(), action()),
                    fn((state) => app(app(cont(), state()), state())),
                    fn(() => app(app(cont(), term()), term()))
                  )
                )
              )
            )
          ),
          return: fn((x) => fn((state) => _eval(tuple(state(), x())))),
          body: seq(
            handle(handlerStateId, _eval(tuple(_eval(num(1)), num(2)))),
            handle(handlerStateId, _eval(tuple(_eval(num(1)), num(3)))),
            _eval(num(0))
          ),
        }),
        _eval(num(1))
      );

      expect(toTuple(term).map(toNumber)).toEqual([3, 0]);
    });

    test.todo("state example 3", async () => {
      const handlerStateId = 1;
      const term = app(
        inject({
          id: handlerStateId,
          handler: _eval(
            fnN(2, (term, cont) =>
              app(
                term(),
                fnN(2, (action, term) =>
                  _if(
                    app(isZero(), action()),
                    fn((state) => app(app(cont(), state()), state())),
                    fn(() => app(app(cont(), term()), term()))
                  )
                )
              )
            )
          ),
          return: fn((x) => fn((state) => _eval(tuple(state(), x())))),
          body: seq(
            _eval(
              handle(handlerStateId, tuple(_eval(num(1)), app(succ(), handle(handlerStateId, tuple(num(0), num(0))))))
            ),
            _eval(num(0))
          ),
        }),
        _eval(num(0))
      );
      console.log(stringify(term));

      console.dir(term, { depth: null });

      expect(toTuple(term).map(toNumber)).toEqual([1, 0]);
    });

    // test.only("state example", async () => {
    //   const handlerStateId = 1;
    //   const term = inject({
    //     id: handlerStateId,
    //     handler: _eval(
    //       fnN(2, (term, cont) =>
    //         app(
    //           term(),
    //           fnN(2, (action, term) =>
    //             _if(
    //               app(isZero(), action()),
    //               fn((state) => app(app(cont(), state()), state())),
    //               fn(() => app(app(cont(), term()), term()))
    //             )
    //           )
    //         )
    //       )
    //     ),
    //     return: fn((x) => fn((state) => _eval(tuple(state(), x())))),
    //     body: _let(handle(handlerStateId, _eval(tuple(num(0), num(0)))), (state) =>
    //       seq(handle(handlerStateId, _eval(tuple(_eval(num(1)), app(succ(), state())))), _eval(num(0)))
    //     ),
    //   });
    //   console.log(stringify(term));

    //   console.dir(term, { depth: null });

    //   expect(toTuple(term).map(toNumber)).toEqual([1, 0]);
    // });

    // it("transaction example", async () => {
    //   const input = `
    //     // can abstract db queries for example, instead of simple value state
    //     state :=
    //       get: handler fn (callback, _) {
    //         fn state do (callback state) state
    //       },
    //       set: handler fn (callback, state) {
    //         fn do (callback state) state
    //       },
    //       [return_handler]: fn x {
    //         fn state do state, x
    //       }
    //     transaction :=
    //       get: handler fn (callback, _) {
    //         fn state do (callback state) state
    //       },
    //       set: handler fn (callback, state) {
    //         fn do (callback state) state
    //       },
    //       [return_handler]: fn x {
    //         fn state { set state; x }
    //       }

    //     set := :set |> handle
    //     get := :get |> handle

    //     inject state {
    //       set 123
    //       inject transaction {
    //         set(get() + 1)
    //         get()
    //       }
    //       get() + 234
    //     } 1
    //   `;
    //   const result = await evaluate(input);
    //   expect(result).toStrictEqual([123, 357]);
    // });
  });
}
