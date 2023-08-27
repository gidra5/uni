import {
  TermKind,
  HOASTerm as Term,
  isEqualTerms,
  evaluate,
  inferType,
  print,
  HOASToResolved,
  Context,
  ResolvedTerm,
  StarTerm,
  BoxTerm,
  ResolvedApplicationTerm,
  ResolvedFunctionTerm,
  VariableTerm,
  StrictResolvedVariableTerm,
  resolve,
} from "../src/typechecker.js";
import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import fc from "fast-check";

// const AnnotationTermSymbol = TermKind.Application;
const ApplicationTermSymbol = TermKind.Application;
const FunctionTermSymbol = TermKind.Function;
const PiFunctionTermSymbol = TermKind.PiFunction;
const UnitTermSymbol = TermKind.Kind;
const UniverseTermSymbol = TermKind.Kind;
const VariableTermSymbol = TermKind.Variable;

function curry(f: (head: Term, ...terms: Term[]) => Term, depth = 1): Term {
  if (depth === 1)
    return {
      kind: FunctionTermSymbol,
      variableType: { kind: TermKind.Kind },
      body: f,
    };
  return {
    kind: FunctionTermSymbol,
    variableType: { kind: TermKind.Kind },
    body: (x) => curry((...terms) => f(x, ...terms), depth - 1),
  };
}

function curry3(f: (x: Term, y: Term, z: Term) => Term): Term {
  return curry(f, 3);
}

function curry4(f: (w: Term, x: Term, y: Term, z: Term) => Term): Term {
  return curry(f, 4);
}

function curry5(
  f: (v: Term, w: Term, x: Term, y: Term, z: Term) => Term
): Term {
  return curry(f, 5);
}

// A left-folded application function
function application(f: Term, args: Term[]): Term {
  return args.reduce(
    (fn, arg) => ({ kind: ApplicationTermSymbol, fn, arg }),
    f
  );
}

function checkBetaEq(term1: Term, term2: Term): boolean {
  return isEqualTerms(
    evaluate(HOASToResolved(term1)),
    evaluate(HOASToResolved(term2))
  );
}

function checkInfer(ctx: Context, term: Term, typeTerm: Term): boolean {
  return isEqualTerms(
    evaluate(inferType(HOASToResolved(term), ctx)),
    evaluate(HOASToResolved(typeTerm))
  );
}
function checkInfer2(
  ctx: Context,
  term: Term,
  typeTerm: ResolvedTerm
): boolean {
  return isEqualTerms(
    evaluate(inferType(HOASToResolved(term), ctx)),
    evaluate(typeTerm)
  );
}

function assertBetaEq(term1: Term, term2: Term): void {
  expect(checkBetaEq(term1, term2)).toBe(true);
}

function assertInfer(ctx: Context, term: Term, typeTerm: Term): void {
  expect(checkInfer(ctx, term, typeTerm)).toBe(true);
}
function assertInfer2(ctx: Context, term: Term, typeTerm: ResolvedTerm): void {
  expect(checkInfer2(ctx, term, typeTerm)).toBe(true);
}
const check = (
  term: ResolvedTerm,
  expected: ResolvedTerm,
  ctx: Context = []
) => {
  inferType(term, ctx);
  expect(isEqualTerms(evaluate(term), evaluate(expected))).toBe(true);
};

const fn = (
  args: [variable: string, variableType: ResolvedTerm][],
  body: ResolvedTerm
): ResolvedTerm =>
  resolve(
    args.reduceRight(
      (body, [variable, variableType]) => ({
        kind: TermKind.Function,
        variable,
        variableType,
        body,
      }),
      body
    )
  );

const piFn = (
  args: [variable: string, variableType: ResolvedTerm][],
  body: ResolvedTerm
): ResolvedTerm =>
  resolve(
    args.reduceRight(
      (body, [variable, variableType]) => ({
        kind: TermKind.PiFunction,
        variable,
        variableType,
        body,
      }),
      body
    )
  );

const appl = (fn: ResolvedTerm, ...args: ResolvedTerm[]): ResolvedTerm =>
  resolve(
    args.reduce((fn, arg) => ({ kind: TermKind.Application, fn, arg }), fn)
  );

const variable = (name: string): VariableTerm => ({
  kind: TermKind.Variable,
  name,
});

const variable2 = (
  index: number,
  name?: string
): StrictResolvedVariableTerm => ({
  kind: TermKind.Variable,
  index,
  name,
});

const star: StarTerm = { kind: TermKind.Type };
const box: BoxTerm = { kind: TermKind.Kind };

describe.skip("Calculus of Constructions", () => {
  // Church numerals
  const nTy: Term = {
    kind: PiFunctionTermSymbol,
    variableType: { kind: UnitTermSymbol },
    body: (_a: Term) => ({
      kind: PiFunctionTermSymbol,
      variableType: {
        kind: PiFunctionTermSymbol,
        variableType: _a,
        body: () => _a,
      },
      body: (_f: Term) => ({
        kind: PiFunctionTermSymbol,
        variableType: _a,
        body: () => _a,
      }),
    }),
  };

  // The zero constant and successor function.
  const zero: Term = curry3((_a: Term, _f: Term, x: Term) => x);
  const succ: Term = curry4((n: Term, a: Term, f: Term, x: Term) =>
    application(f, [application(n, [a, f, x])])
  );

  // The addition function on two numerals.
  const addTy: Term = {
    kind: PiFunctionTermSymbol,
    variableType: nTy,
    body: (_n: Term) => ({
      kind: PiFunctionTermSymbol,
      variableType: nTy,
      body: (_m: Term) => nTy,
    }),
  };
  const add: Term = curry5((n: Term, m: Term, a: Term, f: Term, x: Term) =>
    application(n, [a, f, application(m, [a, f, x])])
  );

  // Church pairs.
  const pairTy: Term = {
    kind: PiFunctionTermSymbol,
    variableType: { kind: UnitTermSymbol },
    body: (_a: Term) => ({
      kind: PiFunctionTermSymbol,
      variableType: { kind: UnitTermSymbol },
      body: (_b: Term) => ({ kind: UnitTermSymbol }),
    }),
  };
  const pair: Term = {
    kind: FunctionTermSymbol,
    variableType: { kind: UnitTermSymbol },
    body: (a: Term) => ({
      kind: FunctionTermSymbol,
      variableType: { kind: UnitTermSymbol },
      body: (b: Term) => ({
        kind: PiFunctionTermSymbol,
        variableType: { kind: UnitTermSymbol },
        body: (c: Term) => ({
          kind: PiFunctionTermSymbol,
          variableType: {
            kind: PiFunctionTermSymbol,
            variableType: a,
            body: () => ({
              kind: PiFunctionTermSymbol,
              variableType: b,
              body: () => c,
            }),
          },
          body: () => c,
        }),
      }),
    }),
  };

  it("church numerals", () => {
    // 1, 2, 3, 4 derived from zero and the successor function.
    const one: Term = application(succ, [zero]);
    const two: Term = application(succ, [one]);
    const three: Term = application(succ, [two]);
    const four: Term = application(succ, [three]);

    assertInfer([], zero, nTy);
    assertInfer([], one, nTy);
    assertInfer([], two, nTy);
    assertInfer([], three, nTy);
    assertInfer([], four, nTy);
  });

  it("church numerals sum", () => {
    // 1, 2, 3, 4 derived from zero and the successor function.
    const one: Term = application(succ, [zero]);
    const two: Term = application(succ, [one]);
    const three: Term = application(succ, [two]);
    const four: Term = application(succ, [three]);

    assertInfer([], add, addTy);

    // Test addition on the derived numerals.
    assertBetaEq(application(add, [zero, zero]), zero);
    assertBetaEq(application(add, [zero, one]), one);
    assertBetaEq(application(add, [one, zero]), one);
    assertBetaEq(application(add, [three, one]), four);
  });

  it("pair type", () => {
    assertInfer([], pair, pairTy);
  });

  it("typesafe vectors", () => {
    // 1, 2, 3, 4 derived from zero and the successor function.
    const one: Term = application(succ, [zero]);
    const two: Term = application(succ, [one]);
    const three: Term = application(succ, [two]);
    const four: Term = application(succ, [three]);

    // Type-safe programming with vectors.
    const vectTy = (n: Term, a: Term) =>
      application({ kind: VariableTermSymbol, index: 0 }, [n, a]);
    const itemTy: Term = { kind: VariableTermSymbol, index: 1 };
    const item: Term = { kind: VariableTermSymbol, index: 2 };

    /* The concatenate function on two vectors. */
    const concat: Term = {
      kind: PiFunctionTermSymbol,
      variableType: nTy,
      body: (n) => ({
        kind: PiFunctionTermSymbol,
        variableType: nTy,
        body: (m) => ({
          kind: PiFunctionTermSymbol,
          variableType: { kind: UnitTermSymbol },
          body: (a) => ({
            kind: PiFunctionTermSymbol,
            variableType: vectTy(n, a),
            body: () => ({
              kind: PiFunctionTermSymbol,
              variableType: vectTy(m, a),
              body: () => vectTy(application(add, [n, m]), a),
            }),
          }),
        }),
      }),
    };

    /* The zip function that takes two vectors of the same length and returns a new zipped vector.  */
    const zip: Term = {
      kind: PiFunctionTermSymbol,
      variableType: nTy,
      body: (n) => ({
        kind: PiFunctionTermSymbol,
        variableType: { kind: UnitTermSymbol },
        body: (a) => ({
          kind: PiFunctionTermSymbol,
          variableType: { kind: UnitTermSymbol },
          body: (b) => ({
            kind: PiFunctionTermSymbol,
            variableType: vectTy(n, a),
            body: () => ({
              kind: PiFunctionTermSymbol,
              variableType: vectTy(n, b),
              body: () => vectTy(n, application(pair, [a, b])),
            }),
          }),
        }),
      }),
    };

    const vector: Term = {
      kind: PiFunctionTermSymbol,
      variableType: nTy,
      body: () => ({
        kind: PiFunctionTermSymbol,
        variableType: { kind: UnitTermSymbol },
        body: () => ({ kind: UnitTermSymbol }),
      }),
    };
    /* The replicate function that constructs a vector containing N items of the same value.  */
    const replicate: Term = {
      kind: PiFunctionTermSymbol,
      variableType: nTy,
      body: (n) => ({
        kind: PiFunctionTermSymbol,
        variableType: { kind: UnitTermSymbol },
        body: (a) => ({
          kind: PiFunctionTermSymbol,
          variableType: a,
          body: () => vectTy(n, a),
        }),
      }),
    };
    /* A typing context must contain only evaluated types. */
    const vectCtx = [
      vector,
      { kind: UnitTermSymbol } as Term,
      itemTy,
      replicate,
      concat,
      zip,
    ]
      .map((type) => evaluate(HOASToResolved(type)))
      .reverse();

    const vectOne = application({ kind: VariableTermSymbol, index: 3 }, [
      one,
      itemTy,
      item,
    ]);
    const vectThree = application({ kind: VariableTermSymbol, index: 3 }, [
      three,
      itemTy,
      item,
    ]);
    const vectFour = application({ kind: VariableTermSymbol, index: 4 }, [
      one,
      three,
      itemTy,
      vectOne,
      vectThree,
    ]);

    assertInfer2(
      vectCtx,
      vectOne,
      evaluate(HOASToResolved(vectTy(one, itemTy)))
    );
    assertInfer2(
      vectCtx,
      vectThree,
      evaluate(HOASToResolved(vectTy(three, itemTy)))
    );
    assertInfer2(
      vectCtx,
      vectFour,
      evaluate(HOASToResolved(vectTy(four, itemTy)))
    );

    const t1 = print(evaluate(HOASToResolved(vectTy(four, itemTy))));
    const t2 = print(evaluate(HOASToResolved(vectTy(one, itemTy))));
    const t3 = print(HOASToResolved(vectOne));
    const zipped = application({ kind: VariableTermSymbol, index: 5 }, [
      four,
      itemTy,
      itemTy,
      vectOne,
      vectFour,
    ]);

    // If we attempt to zip two vectors of different lengths, the type checker
    // will produce an appropriate error message.
    expect(() =>
      checkInfer(vectCtx, zipped, { kind: UniverseTermSymbol })
    ).toThrowError(`Want type ${t1}, got ${t2}: ${t3}`);
  });
});

describe.skip("Calculus of Constructions 2", () => {
  it("Church Booleans", () => {
    const _true = fn(
      [
        ["a", star],
        ["x", variable("a")],
        ["y", variable("a")],
      ],
      variable("x")
    );
    const _false = fn(
      [
        ["a", star],
        ["x", variable("a")],
        ["y", variable("a")],
      ],
      variable("y")
    );
    const bool_ty = piFn(
      [
        ["a", star],
        ["x", variable("a")],
        ["y", variable("a")],
      ],
      variable("a")
    );

    expect(inferType(_true)).toEqual(bool_ty);
    expect(inferType(_false)).toEqual(bool_ty);

    const if_then_else = fn(
      [
        ["a", star],
        ["b", bool_ty],
        ["x", variable("a")],
        ["y", variable("a")],
      ],
      appl(variable("b"), variable("a"), variable("x"), variable("y"))
    );

    check(
      appl(
        if_then_else,
        variable2(2, "a"),
        _true,
        variable2(1, "x"),
        variable2(0, "y")
      ),
      variable2(1, "x"),
      [star, variable2(0, "a"), variable2(1, "a")] // a, x, y
    );

    check(
      appl(
        if_then_else,
        variable2(2, "a"),
        _false,
        variable2(1, "x"),
        variable2(0, "y")
      ),
      variable2(0, "y"),
      [star, variable2(0, "a"), variable2(1, "a")] // a, x, y
    );

    const my_not = fn(
      [["b", bool_ty]],
      appl(variable("b"), bool_ty, _false, _true)
    );

    check(appl(my_not, _true), _false);
    check(appl(my_not, _false), _true);

    const my_and = fn(
      [
        ["a", bool_ty],
        ["b", bool_ty],
      ],
      appl(variable("a"), bool_ty, variable("b"), _false)
    );

    check(appl(my_and, _true, _true), _true);
    check(appl(my_and, _true, _false), _false);
    check(appl(my_and, _false, _false), _false);
    check(appl(my_and, _false, _true), _false);

    // const my_or = lam(
    //   "a",
    //   bool_ty,
    //   lam("b", bool_ty, appl([variable("a"), bool_ty, _true, variable("b")]))
    // );

    // check(appl([my_or, _true, _true]), _true);
    // check(appl([my_or, _true, _false]), _true);
    // check(appl([my_or, _false, _false]), _false);
    // check(appl([my_or, _false, _true]), _true);

    // const my_xor = lam(
    //   "a",
    //   bool_ty,
    //   lam(
    //     "b",
    //     bool_ty,
    //     appl([
    //       variable("a"),
    //       bool_ty,
    //       appl([my_not, variable("b")]),
    //       variable("b"),
    //     ])
    //   )
    // );

    // check(appl([my_xor, _true, _true]), _false);
    // check(appl([my_xor, _true, _false]), _true);
    // check(appl([my_xor, _false, _false]), _false);
    // check(appl([my_xor, _false, _true]), _true);
  });
});
