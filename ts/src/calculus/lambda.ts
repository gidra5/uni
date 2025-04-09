import { Arbitrary } from "fast-check";

// pros: allows to easily create domain specific language for constructing terms
// and trivially evaluate terms
type TermHOAS =
  | { type: "var"; id: number; name?: string }
  | { type: "app"; func: TermHOAS; arg: TermHOAS }
  | { type: "abs"; arg?: string; body: (term: TermHOAS) => TermHOAS };

// pros: allows for trivial variable substitution
type TermResolved =
  | { type: "var"; id: number; name?: string }
  | { type: "app"; func: TermResolved; arg: TermResolved }
  | { type: "abs"; arg: { id: number; name?: string }; body: TermResolved };

// pros: trivial to serialize into readable string
type Term =
  | { type: "var"; name: string }
  | { type: "app"; func: Term; arg: Term }
  | { type: "abs"; arg: string; body: Term };

// pros: structural equality is term equality
type TermIndexed =
  | { type: "var"; idx: number; name?: string }
  | { type: "app"; func: TermIndexed; arg: TermIndexed }
  | { type: "abs"; arg?: string; body: TermIndexed };

let id = 0;
const nextId = () => id++;

const freshName = (name?: string) => ({ type: "var", id: nextId(), name } satisfies TermResolved);
const termHOASToTermResolved = (term: TermHOAS, context: Map<number, TermHOAS> = new Map()): TermResolved => {
  switch (term.type) {
    case "var":
      if (context.has(term.id)) return term;
      return freshName(term.name);
    case "app":
      return {
        type: "app",
        func: termHOASToTermResolved(term.func, context),
        arg: termHOASToTermResolved(term.arg, context),
      };
    case "abs":
      const __var = freshName(term.arg);
      return {
        type: "abs",
        arg: { name: __var.name, id: __var.id },
        body: termHOASToTermResolved(term.body(__var as any), context.set(__var.id, __var)),
      };
    default:
      throw new Error("not a term");
  }
};

const termResolvedToTermHOAS = (term: TermResolved, context: Map<number, TermHOAS> = new Map()): TermHOAS => {
  switch (term.type) {
    case "var":
      if (!context.has(term.id)) return term;
      return context.get(term.id)!;
    case "app":
      return {
        type: "app",
        func: termResolvedToTermHOAS(term.func, context),
        arg: termResolvedToTermHOAS(term.arg, context),
      };
    case "abs":
      return {
        type: "abs",
        arg: term.arg.name,
        body: (arg) => termResolvedToTermHOAS(term.body, context.set(term.arg.id, arg)),
      };
    default:
      throw new Error("not a term");
  }
};

const termToTermResolved = (term: Term, context: Array<[string, TermResolved]> = []): TermResolved => {
  switch (term.type) {
    case "var":
      const resolved = context.find(([name]) => name === term.name);
      if (!resolved) return freshName(term.name);
      return resolved[1];
    case "app":
      return { type: "app", func: termToTermResolved(term.func, context), arg: termToTermResolved(term.arg, context) };
    case "abs":
      const __var = freshName(term.arg);
      const ctx: Array<[string, TermResolved]> = [...context, [term.arg, __var]];
      return { type: "abs", arg: { name: __var.name, id: __var.id }, body: termToTermResolved(term.body, ctx) };
    default:
      throw new Error("not a term");
  }
};

const termResolvedToTerm = (term: TermResolved): Term => {
  const stringifyName = (term: { name?: string; id: number }) => term.name ?? `#${term.id}`;
  switch (term.type) {
    case "var":
      return { type: "var", name: stringifyName(term) };
    case "app":
      return { type: "app", func: termResolvedToTerm(term.func), arg: termResolvedToTerm(term.arg) };
    case "abs":
      return { type: "abs", arg: stringifyName(term.arg), body: termResolvedToTerm(term.body) };
    default:
      throw new Error("not a term");
  }
};

const termToTermIndexed = (term: Term, context: string[] = []): TermIndexed => {
  switch (term.type) {
    case "var":
      let idx = context.indexOf(term.name);
      return { type: "var", idx, name: term.name };
    case "app":
      return { type: "app", func: termToTermIndexed(term.func), arg: termToTermIndexed(term.arg) };
    case "abs":
      return { type: "abs", arg: term.arg, body: termToTermIndexed(term.body, [term.arg, ...context]) };
  }
};

const termIndexedToTerm = (term: TermIndexed, context: string[] = []): Term => {
  switch (term.type) {
    case "var":
      return { type: "var", name: context[term.idx] ?? term.name };
    case "app":
      return { type: "app", func: termIndexedToTerm(term.func, context), arg: termIndexedToTerm(term.arg, context) };
    case "abs":
      const name = term.arg ?? `#${nextId()}`;
      return { type: "abs", arg: name, body: termIndexedToTerm(term.body, [name, ...context]) };
  }
};

const _app = (func: TermHOAS, arg: TermHOAS): TermHOAS => ({ type: "app", func, arg });
const app = (func: TermHOAS, ...[head, ...rest]: TermHOAS[]): TermHOAS =>
  rest.length === 0 ? _app(func, head) : app(_app(func, head), ...rest);
const abs = (body: (term: TermHOAS) => TermHOAS): TermHOAS => ({ type: "abs", body });
const _absName = (name: string, body: (term: TermHOAS) => TermHOAS): TermHOAS => ({ type: "abs", arg: name, body });
const absName = ([head, ...rest]: string[], body: (...terms: TermHOAS[]) => TermHOAS): TermHOAS =>
  rest.length === 0
    ? _absName(head, body)
    : _absName(head, (term) => absName(rest, (...terms) => body(term, ...terms)));

const reduceHOAS = (term: TermHOAS, context: Map<number, TermHOAS> = new Map()): TermHOAS => {
  switch (term.type) {
    case "app":
      const func = reduceHOAS(term.func, context);
      const arg = reduceHOAS(term.arg, context);
      switch (func.type) {
        case "abs":
          return reduceHOAS(func.body(arg));
        default:
          return app(func, arg);
      }
    case "var":
      if (context.has(term.id)) return context.get(term.id)!;
      return term;
    default:
      return term;
  }
};
const stringify = (term: Term): string => {
  switch (term.type) {
    case "var":
      return term.name;
    case "app":
      if (term.func.type === "abs") return `(${stringify(term.func)}) ${stringify(term.arg)}`;
      return `${stringify(term.func)} ${stringify(term.arg)}`;
    case "abs":
      return `fn ${term.arg} -> ${stringify(term.body)}`;
    default:
      throw new Error("not a term");
  }
};

export {};

if (import.meta.vitest) {
  const { expect, beforeEach } = import.meta.vitest;
  const { test, fc } = await import("@fast-check/vitest");

  beforeEach(() => {
    id = 0;
  });

  const termArb = (names: string[]): Arbitrary<Term> => {
    return fc.letrec<{
      freshName: string;
      anyName: string;
      var: Term;
      app: Term;
      abs: Term;
      term: Term;
    }>((tie) => ({
      freshName: fc.string({ minLength: 1 }).filter((x) => !names.includes(x)),
      anyName: fc.oneof(...names.map(fc.constant), tie("freshName")),
      var: fc.record({
        type: fc.constant("var"),
        name: tie("anyName"),
      }),
      app: fc.record({ type: fc.constant("app"), func: tie("term"), arg: tie("term") }),
      abs: tie("anyName").chain((name) =>
        fc.record({ type: fc.constant("abs"), arg: fc.constant(name), body: termArb([...names, name]) })
      ),
      term: fc.oneof(tie("var"), tie("app"), tie("abs")),
    })).term;
  };

  const termResolvedArb = (names: string[]) =>
    termArb(names).map((term) => {
      id = 0;
      return termToTermResolved(term, []);
    });
  const termHOASArb = (names: string[]) =>
    termResolvedArb(names).map((term) => {
      id = 0;
      return termResolvedToTermHOAS(term);
    });

  test.prop([termArb([])])("term and indexed term are isomorphic", (term) => {
    expect(termIndexedToTerm(termToTermIndexed(term, []))).toEqual(term);
  });

  test.prop([termArb([])])("term and resolved term are isomorphic", (term) => {
    expect(termResolvedToTerm(termToTermResolved(term, []))).toEqual(term);
  });

  test.prop([termResolvedArb([])])("resolved term and hoas term are isomorphic", (term) => {
    id = 0;
    const x = termResolvedToTermHOAS(term, new Map());
    const y = termHOASToTermResolved(x, new Map());
    expect(y).toEqual(term);
  });

  test("eval inject", () => {
    const ctx = new Map();
    const inc = freshName("inc");
    const zero = freshName("zero");
    ctx.set(zero.id, 0);
    ctx.set(
      inc.id,
      abs((x) => (x as any) + 1)
    );

    const expr = app(inc, app(inc, zero));

    expect(reduceHOAS(expr, ctx)).toEqual(2);
  });

  test("stringify", () => {
    const termHOAS = absName(["x", "y", "m"], (x, y, m) => app(m, x, y));
    const termResolved = termHOASToTermResolved(termHOAS);
    const term = termResolvedToTerm(termResolved);
    expect(stringify(term)).toEqual("fn x -> fn y -> fn m -> m x y");
  });
}
