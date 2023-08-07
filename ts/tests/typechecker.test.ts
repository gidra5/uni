import {
  AnnotationTermSymbol,
  ApplicationTermSymbol,
  FunctionTermSymbol,
  PiFunctionTermSymbol,
  Term,
  UnitTermSymbol,
  UniverseTermSymbol,
  VariableTermSymbol,
  equate,
  evaluate,
  inferType,
  print,
} from "../src/typechecker.js";
import { describe, expect, it } from "vitest";

function curry(f: (head: Term, ...terms: Term[]) => Term, n = 1): Term {
  if (n === 1) return { kind: FunctionTermSymbol, body: f };
  return {
    kind: FunctionTermSymbol,
    body: (x) => curry((...terms) => f(x, ...terms), n - 1),
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
    (func, arg) => ({ kind: ApplicationTermSymbol, func, arg }),
    f
  );
}

function checkBetaEq(term1: Term, term2: Term, lvl = 0): boolean {
  return equate(lvl, evaluate(term1), evaluate(term2));
}

function checkInfer(ctx: Term[], term: Term, typeTerm: Term): boolean {
  return checkBetaEq(inferType(ctx.length, ctx, term), typeTerm, ctx.length);
}

// Jest-style test for beta-convertibility
function assertBetaEq(term1: Term, term2: Term): void {
  expect(checkBetaEq(term1, term2)).toBe(true);
}

// Jest-style test for beta-convertibility
function assertInfer(ctx: Term[], term: Term, typeTerm: Term): void {
  expect(checkInfer(ctx, term, typeTerm)).toBe(true);
}

describe("Calculus of Constructions", () => {
  // Church numerals
  const nTy: Term = {
    kind: PiFunctionTermSymbol,
    paramType: { kind: UnitTermSymbol },
    returnType: (_a: Term) => ({
      kind: PiFunctionTermSymbol,
      paramType: {
        kind: PiFunctionTermSymbol,
        paramType: _a,
        returnType: () => _a,
      },
      returnType: (_f: Term) => ({
        kind: PiFunctionTermSymbol,
        paramType: _a,
        returnType: () => _a,
      }),
    }),
  };

  // The zero constant and successor function.
  const zero: Term = {
    kind: AnnotationTermSymbol,
    term: curry3((_a: Term, _f: Term, x: Term) => x),
    type: nTy,
  };
  const succ: Term = {
    kind: AnnotationTermSymbol,
    term: curry4((n: Term, a: Term, f: Term, x: Term) =>
      application(f, [application(n, [a, f, x])])
    ),
    type: {
      kind: PiFunctionTermSymbol,
      paramType: nTy,
      returnType: () => nTy,
    },
  };

  // The addition function on two numerals.
  const addTy: Term = {
    kind: PiFunctionTermSymbol,
    paramType: nTy,
    returnType: (_n: Term) => ({
      kind: PiFunctionTermSymbol,
      paramType: nTy,
      returnType: (_m: Term) => nTy,
    }),
  };
  const add: Term = {
    kind: AnnotationTermSymbol,
    term: curry5((n: Term, m: Term, a: Term, f: Term, x: Term) =>
      application(n, [a, f, application(m, [a, f, x])])
    ),
    type: addTy,
  };

  // Church pairs.
  const pairTy: Term = {
    kind: PiFunctionTermSymbol,
    paramType: { kind: UnitTermSymbol },
    returnType: (_a: Term) => ({
      kind: PiFunctionTermSymbol,
      paramType: { kind: UnitTermSymbol },
      returnType: (_b: Term) => ({ kind: UnitTermSymbol }),
    }),
  };
  const pair: Term = {
    kind: AnnotationTermSymbol,
    term: {
      kind: FunctionTermSymbol,
      body: (a: Term) => ({
        kind: FunctionTermSymbol,
        body: (b: Term) => ({
          kind: PiFunctionTermSymbol,
          paramType: { kind: UnitTermSymbol },
          returnType: (c: Term) => ({
            kind: PiFunctionTermSymbol,
            paramType: {
              kind: PiFunctionTermSymbol,
              paramType: a,
              returnType: () => ({
                kind: PiFunctionTermSymbol,
                paramType: b,
                returnType: () => c,
              }),
            },
            returnType: () => c,
          }),
        }),
      }),
    },
    type: pairTy,
  };
  it("church numerals", () => {
    // 1, 2, 3, 4 derived from zero and the successor function.
    const one: Term = application(succ, [zero]);
    const two: Term = application(succ, [one]);
    const three: Term = application(succ, [two]);
    const four: Term = application(succ, [three]);

    expect(print(0, nTy)).toBe("(pi *.(pi (pi 0.0).(pi 0.0)))");

    expect(print(0, zero)).toBe(
      "((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))"
    );
    expect(print(0, one)).toBe(
      "(((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))"
    );
    expect(print(0, two)).toBe(
      "(((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))))"
    );
    expect(print(0, three)).toBe(
      "(((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))))"
    );
    expect(print(0, four)).toBe(
      "(((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))))))"
    );

    expect(print(0, evaluate(one))).toBe("(lambda (lambda (lambda (1 2))))");
    expect(print(0, evaluate(two))).toBe(
      "(lambda (lambda (lambda (1 (1 2)))))"
    );
    expect(print(0, evaluate(three))).toBe(
      "(lambda (lambda (lambda (1 (1 (1 2))))))"
    );
    expect(print(0, evaluate(four))).toBe(
      "(lambda (lambda (lambda (1 (1 (1 (1 2)))))))"
    );
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
    expect(print(0, add)).toBe(
      "((lambda (lambda (lambda (lambda (lambda (((0 2) 3) (((1 2) 3) 4))))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2))))))"
    );
    expect(print(0, addTy)).toBe(
      "(pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2)))))"
    );
    assertInfer([], add, addTy);

    // Test addition on the derived numerals.
    assertBetaEq(application(add, [zero, zero]), zero);
    assertBetaEq(application(add, [zero, one]), one);
    assertBetaEq(application(add, [one, zero]), one);
    assertBetaEq(application(add, [three, one]), four);

    expect(print(0, application(add, [zero, zero]))).toBe(
      "((((lambda (lambda (lambda (lambda (lambda (((0 2) 3) (((1 2) 3) 4))))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2)))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))"
    );
    expect(print(0, application(add, [zero, one]))).toBe(
      "((((lambda (lambda (lambda (lambda (lambda (((0 2) 3) (((1 2) 3) 4))))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2)))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))))"
    );
    expect(print(0, application(add, [one, zero]))).toBe(
      "((((lambda (lambda (lambda (lambda (lambda (((0 2) 3) (((1 2) 3) 4))))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2)))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))"
    );
    expect(print(0, application(add, [three, one]))).toBe(
      "((((lambda (lambda (lambda (lambda (lambda (((0 2) 3) (((1 2) 3) 4))))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi (pi 2.2).(pi 2.2)))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0)))))))) (((lambda (lambda (lambda (lambda (2 (((0 1) 2) 3)))))) : (pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi (pi 1.1).(pi 1.1))))) ((lambda (lambda (lambda 2))) : (pi *.(pi (pi 0.0).(pi 0.0))))))"
    );
  });

  it("pair type", () => {
    expect(print(0, pair)).toBe(
      "((lambda (lambda (pi *.(pi (pi 0.(pi 1.2)).2)))) : (pi *.(pi *.*)))"
    );
    expect(print(0, pairTy)).toBe("(pi *.(pi *.*))");
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
      paramType: nTy,
      returnType: (n) => ({
        kind: PiFunctionTermSymbol,
        paramType: nTy,
        returnType: (m) => ({
          kind: PiFunctionTermSymbol,
          paramType: { kind: UnitTermSymbol },
          returnType: (a) => ({
            kind: PiFunctionTermSymbol,
            paramType: vectTy(n, a),
            returnType: () => ({
              kind: PiFunctionTermSymbol,
              paramType: vectTy(m, a),
              returnType: () => vectTy(application(add, [n, m]), a),
            }),
          }),
        }),
      }),
    };

    /* The zip function that takes two vectors of the same length and returns a new zipped vector.  */
    const zip: Term = {
      kind: PiFunctionTermSymbol,
      paramType: nTy,
      returnType: (n) => ({
        kind: PiFunctionTermSymbol,
        paramType: { kind: UnitTermSymbol },
        returnType: (a) => ({
          kind: PiFunctionTermSymbol,
          paramType: { kind: UnitTermSymbol },
          returnType: (b) => ({
            kind: PiFunctionTermSymbol,
            paramType: vectTy(n, a),
            returnType: () => ({
              kind: PiFunctionTermSymbol,
              paramType: vectTy(n, b),
              returnType: () => vectTy(n, application(pair, [a, b])),
            }),
          }),
        }),
      }),
    };

    const vector: Term = {
      kind: PiFunctionTermSymbol,
      paramType: nTy,
      returnType: () => ({
        kind: PiFunctionTermSymbol,
        paramType: { kind: UnitTermSymbol },
        returnType: () => ({ kind: UnitTermSymbol }),
      }),
    };
    /* The replicate function that constructs a vector containing N items of the same value.  */
    const replicate: Term = {
      kind: PiFunctionTermSymbol,
      paramType: nTy,
      returnType: (n) => ({
        kind: PiFunctionTermSymbol,
        paramType: { kind: UnitTermSymbol },
        returnType: (a) => ({
          kind: PiFunctionTermSymbol,
          paramType: a,
          returnType: () => vectTy(n, a),
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
      .map((type) => evaluate(type))
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

    expect(print(0, vector)).toBe(
      "(pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.*))"
    );
    expect(print(0, replicate)).toBe(
      "(pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi 1.((0 0) 1))))"
    );
    expect(print(0, zip)).toBe(
      "(pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi *.(pi *.(pi ((0 0) 1).(pi ((0 0) 2).((0 0) ((((lambda (lambda (pi *.(pi (pi 5.(pi 6.7)).7)))) : (pi *.(pi *.*))) 1) 2)))))))"
    );
    expect(print(0, concat)).toBe(
      "(pi (pi *.(pi (pi 0.0).(pi 0.0))).(pi (pi *.(pi (pi 1.1).(pi 1.1))).(pi *.(pi ((0 0) 2).(pi ((0 1) 2).((0 ((((lambda (lambda (lambda (lambda (lambda (((5 7) 8) (((6 7) 8) 9))))))) : (pi (pi *.(pi (pi 5.5).(pi 5.5))).(pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7)))))) 0) 1)) 2))))))"
    );

    expect(print(vectCtx.length, vectOne)).toBe(
      "(((3 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))) 1) 2)"
    );
    expect(print(vectCtx.length, evaluate(vectTy(one, itemTy)))).toBe(
      "((0 (lambda (lambda (lambda (7 8))))) 1)"
    );

    expect(print(vectCtx.length, vectThree)).toBe(
      "(((3 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))))) 1) 2)"
    );
    expect(print(vectCtx.length, evaluate(vectTy(three, itemTy)))).toBe(
      "((0 (lambda (lambda (lambda (7 (7 (7 8))))))) 1)"
    );

    expect(print(vectCtx.length, vectFour)).toBe(
      "(((((4 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))))) 1) (((3 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))) 1) 2)) (((3 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))))) 1) 2))"
    );
    expect(print(vectCtx.length, evaluate(vectTy(four, itemTy)))).toBe(
      "((0 (lambda (lambda (lambda (7 (7 (7 (7 8)))))))) 1)"
    );

    assertInfer(vectCtx, vectOne, evaluate(vectTy(one, itemTy)));
    assertInfer(vectCtx, vectThree, evaluate(vectTy(three, itemTy)));
    assertInfer(vectCtx, vectFour, evaluate(vectTy(four, itemTy)));

    const t1 = print(vectCtx.length, evaluate(vectTy(four, itemTy)));
    const t2 = print(vectCtx.length, evaluate(vectTy(one, itemTy)));
    const t3 = print(vectCtx.length, vectOne);
    const zipped = application({ kind: VariableTermSymbol, index: 5 }, [
      four,
      itemTy,
      itemTy,
      vectOne,
      vectFour,
    ]);

    expect(t1).toBe("((0 (lambda (lambda (lambda (7 (7 (7 (7 8)))))))) 1)");

    expect(t2).toBe("((0 (lambda (lambda (lambda (7 8))))) 1)");

    expect(t3).toBe(
      "(((3 (((lambda (lambda (lambda (lambda (8 (((6 7) 8) 9)))))) : (pi (pi *.(pi (pi 6.6).(pi 6.6))).(pi *.(pi (pi 7.7).(pi 7.7))))) ((lambda (lambda (lambda 8))) : (pi *.(pi (pi 6.6).(pi 6.6)))))) 1) 2)"
    );

    // If we attempt to zip two vectors of different lengths, the type checker
    // will produce an appropriate error message.
    expect(() =>
      checkInfer(vectCtx, zipped, { kind: UniverseTermSymbol })
    ).toThrowError(`Want type ${t1}, got ${t2}: ${t3}`);
  });
});
