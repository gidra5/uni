import { describe, expect, it } from "vitest";
import { computations as C, stepComputation, values as V, type Computation } from "../src/algebraic-effects/index";

const expectOneStep = (
  input: Computation,
  rule: string,
  expected: Computation
) => {
  const reduced = stepComputation(input);
  expect(reduced).toBeTruthy();
  expect(reduced?.rule).toBe(rule);
  expect(reduced?.term).toEqual(expected);
};

describe("algebraic effects operational semantics", () => {
  const identityHandler = V.handler({
    returnClause: { param: "x", body: C.ret(V.variable("x")) },
    operations: {},
  });

  it("reduces do-context when the bound computation steps", () => {
    const input = C.bind(
      "x",
      C.ifThenElse(V.bool(true), C.ret(V.bool(true)), C.ret(V.bool(false))),
      C.ret(V.variable("x"))
    );

    const expected = C.bind("x", C.ret(V.bool(true)), C.ret(V.variable("x")));
    expectOneStep(input, "Do-Context", expected);
  });

  it("reduces with-context when the handled computation steps", () => {
    const input = C.withHandle(
      identityHandler,
      C.ifThenElse(V.bool(true), C.ret(V.bool(true)), C.ret(V.bool(false)))
    );

    const expected = C.withHandle(identityHandler, C.ret(V.bool(true)));
    expectOneStep(input, "With-Context", expected);
  });

  it("reduces do-return by substitution", () => {
    const input = C.bind("x", C.ret(V.bool(true)), C.ret(V.variable("x")));
    const expected = C.ret(V.bool(true));
    expectOneStep(input, "Do-Return", expected);
  });

  it("reduces do-op by pushing the bind into the continuation", () => {
    const input = C.bind("x", C.op("tick", V.bool(true), "y", C.ret(V.variable("y"))), C.ret(V.variable("x")));

    const expected = C.op("tick", V.bool(true), "y", C.bind("x", C.ret(V.variable("y")), C.ret(V.variable("x"))));
    expectOneStep(input, "Do-Op", expected);
  });

  it("reduces if true then c1 else c2 to c1", () => {
    const input = C.ifThenElse(V.bool(true), C.ret(V.bool(true)), C.ret(V.bool(false)));
    expectOneStep(input, "If-True", C.ret(V.bool(true)));
  });

  it("reduces if false then c1 else c2 to c2", () => {
    const input = C.ifThenElse(V.bool(false), C.ret(V.bool(true)), C.ret(V.bool(false)));
    expectOneStep(input, "If-False", C.ret(V.bool(false)));
  });

  it("reduces function application by beta-reduction", () => {
    const input = C.apply(V.fun("x", C.ret(V.variable("x"))), V.bool(true));
    expectOneStep(input, "App-Beta", C.ret(V.bool(true)));
  });

  it("reduces handling return through the return clause", () => {
    const input = C.withHandle(identityHandler, C.ret(V.bool(true)));
    expectOneStep(input, "Handle-Return", C.ret(V.bool(true)));
  });

  it("reduces handled operations through matching handler clauses", () => {
    const decidingHandler = V.handler({
      returnClause: { param: "x", body: C.ret(V.variable("x")) },
      operations: {
        decide: {
          arg: "value",
          k: "k",
          body: C.apply(V.variable("k"), V.bool(true)),
        },
      },
    });

    const continuationBody = C.ifThenElse(V.variable("y"), C.ret(V.bool(true)), C.ret(V.bool(false)));
    const input = C.withHandle(decidingHandler, C.op("decide", V.bool(false), "y", continuationBody));

    const expected = C.apply(
      V.fun("y", C.withHandle(decidingHandler, continuationBody)),
      V.bool(true)
    );
    expectOneStep(input, "Handle-Op-Match", expected);
  });

  it("forwards unhandled operations while preserving handling context", () => {
    const input = C.withHandle(identityHandler, C.op("unknown", V.bool(true), "y", C.ret(V.variable("y"))));
    const expected = C.op("unknown", V.bool(true), "y", C.withHandle(identityHandler, C.ret(V.variable("y"))));
    expectOneStep(input, "Handle-Op-Forward", expected);
  });
});
