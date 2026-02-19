import { fc } from "@fast-check/vitest";
import {
  computations as C,
  type Computation,
  type HandlerValue,
  type Value,
  values as V,
} from "../../src/algebraic-effects/index";

const EFFECT_NAMES = ["a", "b", "c", "d"] as const;
const SMALL_INT = fc.integer({ min: -10, max: 10 });
const freshNameArbFor = (variables: readonly string[]) =>
  fc
    .integer({ min: 0, max: 40 })
    .map((id) => `x${id}`)
    .filter((name) => !variables.includes(name));

const literalValueArb = fc.oneof(SMALL_INT.map((value) => V.integer(value)), fc.boolean().map((value) => V.bool(value)));
const mkScriptValueArb = (variables: readonly string[]) => {
  const leaves: fc.Arbitrary<Value>[] = [literalValueArb];
  if (variables.length > 0) leaves.push(fc.constantFrom(...variables).map((name) => V.variable(name)));
  return fc.oneof(...leaves);
};

const isIdentityReturn = (handler: HandlerValue) => {
  if (!handler.returnClause) return true;
  const { param, body } = handler.returnClause;
  return body.kind === "return" && body.value.kind === "var" && body.value.name === param;
};

const mkPureValueArb = (variables: readonly string[], depth: number, reserved: readonly string[]): fc.Arbitrary<Value> => {
  const leaves: fc.Arbitrary<Value>[] = [literalValueArb];
  if (variables.length > 0) leaves.push(fc.constantFrom(...variables).map((name) => V.variable(name)));

  if (depth <= 0) return fc.oneof(...leaves);

  const fnArb = freshNameArbFor(reserved).chain((param) =>
    mkPureComputationArb([...variables, param], depth - 1, [...reserved, param]).map((body) => V.fun(param, body))
  );
  return fc.oneof(...leaves, fnArb);
};

const mkPureComputationArb = (
  variables: readonly string[],
  depth: number,
  reserved: readonly string[]
): fc.Arbitrary<Computation> => {
  const retArb = mkPureValueArb(variables, Math.max(depth - 1, 0), reserved).map((value) => C.ret(value));
  if (depth <= 0) return retArb;

  const bindArb = freshNameArbFor(reserved).chain((name) =>
    fc
      .tuple(
        mkPureComputationArb(variables, depth - 1, [...reserved, name]),
        mkPureComputationArb([...variables, name], depth - 1, [...reserved, name])
      )
      .map(([left, right]) => C.bind(name, left, right))
  );

  const ifArb = fc
    .tuple(
      fc.boolean(),
      mkPureComputationArb(variables, depth - 1, reserved),
      mkPureComputationArb(variables, depth - 1, reserved)
    )
    .map(([condition, thenBranch, elseBranch]) => C.ifThenElse(V.bool(condition), thenBranch, elseBranch));

  const appArb = freshNameArbFor(reserved).chain((param) =>
    fc
      .tuple(
        mkPureComputationArb([...variables, param], depth - 1, [...reserved, param]),
        mkPureValueArb(variables, depth - 1, reserved)
      )
      .map(([body, arg]) => C.apply(V.fun(param, body), arg))
  );

  return fc.oneof(retArb, bindArb, ifArb, appArb);
};

const mkSingleHandlerArb = (): fc.Arbitrary<{ handler: HandlerValue; effect: string }> =>
  fc.tuple(fc.constantFrom(...EFFECT_NAMES), literalValueArb).map(([effect, value]) => ({
    handler: V.handler({
      returnClause: { param: "result", body: C.ret(V.variable("result")) },
      operations: {
        [effect]: {
          arg: "arg",
          k: "k",
          body: C.apply(V.variable("k"), value),
        },
      },
    }),
    effect,
  }));

const mkSingleEffectComputationArb = (
  variables: readonly string[],
  effect: string,
  depth: number,
  reserved: readonly string[]
): fc.Arbitrary<Computation> => {
  const retArb = mkScriptValueArb(variables).map((value) => C.ret(value));
  const opArb = freshNameArbFor(reserved).map((k) => C.op(effect, V.integer(0), k, C.ret(V.variable(k))));
  if (depth <= 0) return fc.oneof(retArb, opArb);

  const bindArb = freshNameArbFor(reserved).chain((name) =>
    fc
      .tuple(
        mkSingleEffectComputationArb(variables, effect, depth - 1, [...reserved, name]),
        mkSingleEffectComputationArb([...variables, name], effect, depth - 1, [...reserved, name])
      )
      .map(([left, right]) => C.bind(name, left, right))
  );

  const ifArb = fc
    .tuple(
      fc.boolean(),
      mkSingleEffectComputationArb(variables, effect, depth - 1, reserved),
      mkSingleEffectComputationArb(variables, effect, depth - 1, reserved)
    )
    .map(([condition, thenBranch, elseBranch]) => C.ifThenElse(V.bool(condition), thenBranch, elseBranch));

  const appArb = freshNameArbFor(reserved).chain((param) =>
    fc
      .tuple(
        mkSingleEffectComputationArb([...variables, param], effect, depth - 1, [...reserved, param]),
        mkScriptValueArb(variables)
      )
      .map(([body, arg]) => C.apply(V.fun(param, body), arg))
  );

  return fc.oneof(retArb, opArb, bindArb, ifArb, appArb);
};

const translateValue = (value: Value): string => {
  switch (value.kind) {
    case "var":
      return value.name;
    case "bool":
      return value.value ? "true" : "false";
    case "int":
      return String(value.value);
    case "fun":
      return `fn ${value.param} { ${translateComputation(value.body)} }`;
    case "handler":
      throw new Error("handler values are only translatable as inject records");
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
};

const translateHandlerRecord = (handler: HandlerValue): string => {
  if (!isIdentityReturn(handler)) throw new Error("only handlers with identity return clause are translatable");
  const entries = Object.entries(handler.operations);
  const translated = entries.map(([name, clause]) => {
    if (
      clause.body.kind !== "app" ||
      clause.body.fn.kind !== "var" ||
      clause.body.fn.name !== clause.k ||
      clause.body.arg.kind === "var" ||
      clause.body.arg.kind === "fun" ||
      clause.body.arg.kind === "handler"
    ) {
      throw new Error("operation clauses must be in the form k literal");
    }
    return `${name}: ${translateValue(clause.body.arg)}`;
  });
  return `record { ${translated.join(", ")} }`;
};

export const translateComputation = (term: Computation): string => {
  switch (term.kind) {
    case "return":
      return translateValue(term.value);
    case "op":
      if (
        term.continuationBody.kind !== "return" ||
        term.continuationBody.value.kind !== "var" ||
        term.continuationBody.value.name !== term.continuationParam
      ) {
        throw new Error("only op(v; y.return y) is translatable to script");
      }
      return `handle ($${term.operation}) ()`;
    case "do":
      return `{ ${term.name} := ${translateComputation(term.left)}; ${translateComputation(term.right)} }`;
    case "if":
      return `if ${translateValue(term.condition)} { ${translateComputation(term.thenBranch)} } else { ${translateComputation(term.elseBranch)} }`;
    case "app":
      return `(${translateValue(term.fn)}) (${translateValue(term.arg)})`;
    case "with":
      if (term.handler.kind !== "handler") throw new Error("only handler values are translatable in with-handle");
      return `inject ${translateHandlerRecord(term.handler)} -> ${translateComputation(term.body)}`;
    default: {
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
};

export const returnToJsValue = (term: Computation): number | boolean => {
  if (term.kind !== "return") throw new Error("expected return normal form");
  if (term.value.kind === "int") return term.value.value;
  if (term.value.kind === "bool") return term.value.value;
  throw new Error("expected integer or boolean return value");
};

export const pureComputationArb = (maxDepth = 3, variables: readonly string[] = []) =>
  mkPureComputationArb(variables, maxDepth, [...variables]);

export const pureValueArb = (maxDepth = 2, variables: readonly string[] = []) =>
  mkPureValueArb(variables, maxDepth, [...variables]);

export const translatableComputationArb = (maxDepth = 3) =>
  mkSingleHandlerArb().chain(({ handler, effect }) =>
    mkSingleEffectComputationArb([], effect, maxDepth, []).map((body) => C.withHandle(handler, body))
  );

export const effectNameArb = fc.constantFrom(...EFFECT_NAMES);
