import { describe, expect, it } from "vitest";
import {
  computations as C,
  equivalentByNormalization,
  normalizeComputation,
  substituteComputation,
  values as V,
  type Computation,
} from "../src/algebraic-effects/index";

const expectEquivalent = (
  left: Computation,
  right: Computation
) => {
  const { equal, leftNormalForm, rightNormalForm } = equivalentByNormalization(left, right);
  expect(equal).toBe(true);
  expect(leftNormalForm).toEqual(rightNormalForm);
};

describe("algebraic effects term equivalences", () => {
  it("algebraic operation commutes with substitution", () => {
    const original = C.op("tick", V.variable("x"), "y", C.ret(V.variable("y")));
    const left = C.op("tick", V.bool(true), "y", C.ret(V.variable("y")));
    const right = substituteComputation(original, "x", V.bool(true));
    expect(left).toEqual(right);
  });

  it("(1) do x <- return v in c === c[v/x]", () => {
    const left = C.bind("x", C.ret(V.bool(true)), C.ifThenElse(V.variable("x"), C.ret(V.bool(false)), C.ret(V.bool(true))));
    const right = C.ifThenElse(V.bool(true), C.ret(V.bool(false)), C.ret(V.bool(true)));
    expectEquivalent(left, right);
  });

  it("(2) do x <- op(v; y.c1) in c2 === op(v; y. do x <- c1 in c2)", () => {
    const left = C.bind("x", C.op("tick", V.bool(true), "y", C.ret(V.variable("y"))), C.ret(V.variable("x")));
    const right = C.op("tick", V.bool(true), "y", C.bind("x", C.ret(V.variable("y")), C.ret(V.variable("x"))));
    expectEquivalent(left, right);
  });

  it("(3) do x <- c in return x === c", () => {
    const left = C.bind("x", C.ret(V.bool(false)), C.ret(V.variable("x")));
    const right = C.ret(V.bool(false));
    expectEquivalent(left, right);
  });

  it("(4) associativity of sequencing", () => {
    const left = C.bind("x2", C.bind("x1", C.ret(V.bool(true)), C.ret(V.variable("x1"))), C.ret(V.variable("x2")));
    const right = C.bind(
      "x1",
      C.ret(V.bool(true)),
      C.bind("x2", C.ret(V.variable("x1")), C.ret(V.variable("x2")))
    );
    expectEquivalent(left, right);
  });

  it("(5) if true then c1 else c2 === c1", () => {
    expectEquivalent(
      C.ifThenElse(V.bool(true), C.ret(V.bool(true)), C.ret(V.bool(false))),
      C.ret(V.bool(true))
    );
  });

  it("(6) if false then c1 else c2 === c2", () => {
    expectEquivalent(
      C.ifThenElse(V.bool(false), C.ret(V.bool(true)), C.ret(V.bool(false))),
      C.ret(V.bool(false))
    );
  });

  it("(7) if v then c[true/x] else c[false/x] === c[v/x]", () => {
    const template = C.ifThenElse(V.variable("x"), C.ret(V.bool(true)), C.ret(V.bool(false)));
    const left = C.ifThenElse(
      V.bool(true),
      substituteComputation(template, "x", V.bool(true)),
      substituteComputation(template, "x", V.bool(false))
    );
    const right = substituteComputation(template, "x", V.bool(true));
    expectEquivalent(left, right);
  });

  it("(8) (fun x -> c) v === c[v/x]", () => {
    expectEquivalent(C.apply(V.fun("x", C.ret(V.variable("x"))), V.bool(true)), C.ret(V.bool(true)));
  });

  it("(9) fun x -> v x === v (checked extensionally on application)", () => {
    const v = V.fun("z", C.ret(V.variable("z")));
    const leftApplied = C.apply(V.fun("x", C.apply(v, V.variable("x"))), V.bool(true));
    const rightApplied = C.apply(v, V.bool(true));
    expectEquivalent(leftApplied, rightApplied);
  });

  it("(10) with h handle (return v) === cr[v/x]", () => {
    const handler = V.handler({
      returnClause: {
        param: "x",
        body: C.ifThenElse(V.variable("x"), C.ret(V.bool(false)), C.ret(V.bool(true))),
      },
      operations: {},
    });
    const left = C.withHandle(handler, C.ret(V.bool(true)));
    const right = C.ifThenElse(V.bool(true), C.ret(V.bool(false)), C.ret(V.bool(true)));
    expectEquivalent(left, right);
  });

  it("(11) with h handle op_i(v; y.c) === c_i[v/x, (fun y -> with h handle c)/k]", () => {
    const continuationBody = C.ifThenElse(V.variable("y"), C.ret(V.bool(true)), C.ret(V.bool(false)));
    const handler = V.handler({
      returnClause: { param: "x", body: C.ret(V.variable("x")) },
      operations: {
        decide: {
          arg: "value",
          k: "k",
          body: C.apply(V.variable("k"), V.bool(true)),
        },
      },
    });

    const left = C.withHandle(handler, C.op("decide", V.bool(false), "y", continuationBody));
    const right = C.apply(V.fun("y", C.withHandle(handler, continuationBody)), V.bool(true));
    expectEquivalent(left, right);
  });

  it("(12) with h handle op(v; y.c) === op(v; y. with h handle c) for unknown op", () => {
    const handler = V.handler({
      returnClause: { param: "x", body: C.ret(V.variable("x")) },
      operations: {},
    });
    const continuationBody = C.ret(V.variable("y"));

    const left = C.withHandle(handler, C.op("unknown", V.bool(true), "y", continuationBody));
    const right = C.op("unknown", V.bool(true), "y", C.withHandle(handler, continuationBody));
    expectEquivalent(left, right);
  });

  it("(13) with (handler {return x -> c2}) handle c1 === do x <- c1 in c2", () => {
    const c1 = C.ifThenElse(V.bool(true), C.ret(V.bool(true)), C.ret(V.bool(false)));
    const c2 = C.ifThenElse(V.variable("x"), C.ret(V.bool(false)), C.ret(V.bool(true)));
    const handler = V.handler({
      returnClause: { param: "x", body: c2 },
      operations: {},
    });

    const left = C.withHandle(handler, c1);
    const right = C.bind("x", c1, c2);
    const leftNormalized = normalizeComputation(left).term;
    const rightNormalized = normalizeComputation(right).term;
    expect(leftNormalized).toEqual(rightNormalized);
  });
});
