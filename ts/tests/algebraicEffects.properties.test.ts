import { describe, expect } from "vitest";
import { fc, test } from "@fast-check/vitest";
import {
  computations as C,
  equivalentByNormalization,
  normalizeComputation,
  stepComputation,
  substituteComputation,
  type Computation,
  type Value,
  values as V,
} from "../src/algebraic-effects/index";
import {
  effectNameArb,
  observeCoreNormalForm,
  observeVmResult,
  pureComputationArb,
  pureValueArb,
  translatableComputationArb,
  translateComputation,
} from "./utils/algebraicEffectsProperty";
import { FileMap } from "codespan-napi";
import { Injectable, register } from "../src/utils/injector";
import { compileSourceToVm2Bytecode, VM } from "../src/vm/index";

const expectEquivalent = (left: Computation, right: Computation) => {
  const { equal, leftNormalForm, rightNormalForm } = equivalentByNormalization(left, right);
  expect(equal).toBe(true);
  expect(leftNormalForm).toEqual(rightNormalForm);
};

const runVmScript = (program: string) => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());

  const bytecode = compileSourceToVm2Bytecode(program);
  const vm = new VM();
  for (const [name, code] of Object.entries(bytecode)) vm.addCode(name, code);
  return vm.run();
};

const collectCoreCoverage = (term: Computation) => {
  const computationKinds = new Set<Computation["kind"]>();
  const valueKinds = new Set<Value["kind"]>();
  let hasNonIdentityReturnClause = false;

  const isIdentityReturnClause = (param: string, body: Computation) =>
    body.kind === "return" && body.value.kind === "var" && body.value.name === param;

  const walkValue = (value: Value) => {
    valueKinds.add(value.kind);
    switch (value.kind) {
      case "var":
      case "bool":
      case "int":
        return;
      case "fun":
        walkComputation(value.body);
        return;
      case "handler":
        if (value.returnClause) {
          if (!isIdentityReturnClause(value.returnClause.param, value.returnClause.body)) {
            hasNonIdentityReturnClause = true;
          }
          walkComputation(value.returnClause.body);
        }
        Object.values(value.operations).forEach((clause) => walkComputation(clause.body));
        return;
      default: {
        const _exhaustive: never = value;
        return _exhaustive;
      }
    }
  };

  const walkComputation = (computation: Computation) => {
    computationKinds.add(computation.kind);
    switch (computation.kind) {
      case "return":
        walkValue(computation.value);
        return;
      case "op":
        walkValue(computation.value);
        walkComputation(computation.continuationBody);
        return;
      case "do":
        walkComputation(computation.left);
        walkComputation(computation.right);
        return;
      case "if":
        walkValue(computation.condition);
        walkComputation(computation.thenBranch);
        walkComputation(computation.elseBranch);
        return;
      case "app":
        walkValue(computation.fn);
        walkValue(computation.arg);
        return;
      case "with":
        walkValue(computation.handler);
        walkComputation(computation.body);
        return;
      default: {
        const _exhaustive: never = computation;
        return _exhaustive;
      }
    }
  };

  walkComputation(term);
  return { computationKinds, valueKinds, hasNonIdentityReturnClause };
};

describe("algebraic effects equivalence properties", () => {
  test.prop([pureValueArb(2), pureComputationArb(3, ["x"])], { numRuns: 64 })(
    "(1) do x <- return v in c === c[v/x]",
    (v, c) => {
      const left = C.bind("x", C.ret(v), c);
      const right = substituteComputation(c, "x", v);
      expectEquivalent(left, right);
    }
  );

  test.prop([effectNameArb, pureValueArb(2), pureComputationArb(2, ["y"]), pureComputationArb(2, ["x"])], { numRuns: 64 })(
    "(2) do x <- op(v; y.c1) in c2 === op(v; y. do x <- c1 in c2)",
    (effectName, v, c1, c2) => {
      const left = C.bind("x", C.op(effectName, v, "y", c1), c2);
      const right = C.op(effectName, v, "y", C.bind("x", c1, c2));
      const reduced = stepComputation(left);
      expect(reduced?.term).toEqual(right);
    }
  );

  test.prop([pureComputationArb(3)], { numRuns: 64 })("(3) do x <- c in return x === c", (c) => {
    const left = C.bind("x", c, C.ret(V.variable("x")));
    expectEquivalent(left, c);
  });

  test.prop([pureComputationArb(2), pureComputationArb(2, ["x1"]), pureComputationArb(2, ["x2"])], { numRuns: 64 })(
    "(4) sequencing associativity",
    (c1, c2, c3) => {
      const left = C.bind("x2", C.bind("x1", c1, c2), c3);
      const right = C.bind("x1", c1, C.bind("x2", c2, c3));
      expectEquivalent(left, right);
    }
  );

  test.prop([pureComputationArb(3), pureComputationArb(3)], { numRuns: 64 })(
    "(5) if true then c1 else c2 === c1",
    (c1, c2) => {
      expectEquivalent(C.ifThenElse(V.bool(true), c1, c2), c1);
    }
  );

  test.prop([pureComputationArb(3), pureComputationArb(3)], { numRuns: 64 })(
    "(6) if false then c1 else c2 === c2",
    (c1, c2) => {
      expectEquivalent(C.ifThenElse(V.bool(false), c1, c2), c2);
    }
  );

  test.prop([pureComputationArb(3, ["x"]), fc.boolean()], { numRuns: 64 })(
    "(7) if v then c[true/x] else c[false/x] === c[v/x]",
    (c, b) => {
      const left = C.ifThenElse(
        V.bool(b),
        substituteComputation(c, "x", V.bool(true)),
        substituteComputation(c, "x", V.bool(false))
      );
      const right = substituteComputation(c, "x", V.bool(b));
      expectEquivalent(left, right);
    }
  );

  test.prop([pureComputationArb(3, ["x"]), pureValueArb(2)], { numRuns: 64 })(
    "(8) (fun x -> c) v === c[v/x]",
    (c, v) => {
      const left = C.apply(V.fun("x", c), v);
      const right = substituteComputation(c, "x", v);
      expectEquivalent(left, right);
    }
  );

  test.prop([pureComputationArb(2, ["z"]), pureValueArb(2)], { numRuns: 64 })(
    "(9) fun x -> v x === v (checked extensionally on application)",
    (body, arg) => {
      const v = V.fun("z", body);
      const left = C.apply(V.fun("x", C.apply(v, V.variable("x"))), arg);
      const right = C.apply(v, arg);
      expectEquivalent(left, right);
    }
  );

  test.prop([pureValueArb(2), pureComputationArb(3, ["x"])], { numRuns: 64 })(
    "(10) with h handle (return v) === cr[v/x]",
    (v, cr) => {
      const handler = V.handler({
        returnClause: { param: "x", body: cr },
        operations: {},
      });
      const left = C.withHandle(handler, C.ret(v));
      const right = substituteComputation(cr, "x", v);
      expectEquivalent(left, right);
    }
  );

  test.prop([effectNameArb, pureValueArb(2), pureComputationArb(2, ["y"]), pureComputationArb(2, ["value", "k"])], { numRuns: 64 })(
    "(11) with h handle op_i(v; y.c) === c_i[v/x, (fun y -> with h handle c)/k]",
    (effectName, opValue, continuationBody, clauseBody) => {
      const handler = V.handler({
        returnClause: { param: "x", body: C.ret(V.variable("x")) },
        operations: {
          [effectName]: {
            arg: "value",
            k: "k",
            body: clauseBody,
          },
        },
      });

      const left = C.withHandle(handler, C.op(effectName, opValue, "y", continuationBody));
      const right = substituteComputation(
        substituteComputation(clauseBody, "value", opValue),
        "k",
        V.fun("y", C.withHandle(handler, continuationBody))
      );

      const reduced = stepComputation(left);
      expect(reduced?.term).toEqual(right);
    }
  );

  test.prop([fc.tuple(effectNameArb, effectNameArb).filter(([handled, forwarded]) => handled !== forwarded), pureValueArb(2), pureComputationArb(2, ["y"])], { numRuns: 64 })(
    "(12) with h handle op(v; y.c) === op(v; y. with h handle c) when op is not handled",
    ([handledEffect, forwardedEffect], opValue, continuationBody) => {
      const handler = V.handler({
        returnClause: { param: "x", body: C.ret(V.variable("x")) },
        operations: {
          [handledEffect]: {
            arg: "value",
            k: "k",
            body: C.ret(V.variable("value")),
          },
        },
      });

      const left = C.withHandle(handler, C.op(forwardedEffect, opValue, "y", continuationBody));
      const right = C.op(forwardedEffect, opValue, "y", C.withHandle(handler, continuationBody));
      const reduced = stepComputation(left);
      expect(reduced?.term).toEqual(right);
    }
  );

  test.prop([pureComputationArb(3), pureComputationArb(3, ["x"])], { numRuns: 64 })(
    "(13) with (handler {return x -> c2}) handle c1 === do x <- c1 in c2",
    (c1, c2) => {
      const handler = V.handler({
        returnClause: { param: "x", body: c2 },
        operations: {},
      });
      const left = C.withHandle(handler, c1);
      const right = C.bind("x", c1, c2);
      expectEquivalent(left, right);
    }
  );
});

describe("algebraic effects vm agreement properties", () => {
  test("agreement generator spans the full algebraic-effects core", () => {
    const samples = fc.sample(translatableComputationArb(3), 512);
    const computationKinds = new Set<Computation["kind"]>();
    const valueKinds = new Set<Value["kind"]>();
    let hasNonIdentityReturnClause = false;

    for (const sample of samples) {
      const coverage = collectCoreCoverage(sample);
      coverage.computationKinds.forEach((kind) => computationKinds.add(kind));
      coverage.valueKinds.forEach((kind) => valueKinds.add(kind));
      hasNonIdentityReturnClause ||= coverage.hasNonIdentityReturnClause;
    }

    expect([...computationKinds].sort()).toEqual(["app", "do", "if", "op", "return", "with"]);
    expect([...valueKinds].sort()).toEqual(["bool", "fun", "handler", "int", "var"]);
    expect(hasNonIdentityReturnClause).toBe(true);
  });

  test.prop([translatableComputationArb(2)], { numRuns: 32 })(
    "vm execution agrees with reduction for translated algebraic-effects core terms",
    (term) => {
      const normalized = normalizeComputation(term);
      expect(normalized.haltedBecause).toBe("normal-form");
      const expected = observeCoreNormalForm(normalized.term);
      const script = translateComputation(term);
      const vmResult = runVmScript(script);
      const observed = observeVmResult(vmResult);
      expect(observed).toEqual(expected);
    }
  );
});
