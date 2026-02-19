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

const mkAgreementComputationArb = (
  variables: readonly string[],
  depth: number,
  reserved: readonly string[]
): fc.Arbitrary<Computation> => {
  const retArb = mkAgreementValueArb(variables, Math.max(depth - 1, 0), reserved).map((value) => C.ret(value));
  if (depth <= 0) return retArb;

  const bindArb = freshNameArbFor(reserved).chain((name) =>
    fc
      .tuple(
        mkAgreementComputationArb(variables, depth - 1, [...reserved, name]),
        mkAgreementComputationArb([...variables, name], depth - 1, [...reserved, name])
      )
      .map(([left, right]) => C.bind(name, left, right))
  );

  const opArb = fc.constantFrom(...EFFECT_NAMES).chain((effect) =>
    fc
      .tuple(mkAgreementValueArb(variables, Math.max(depth - 1, 0), reserved), freshNameArbFor(reserved))
      .chain(([value, continuationParam]) =>
        mkAgreementComputationArb([...variables, continuationParam], depth - 1, [...reserved, continuationParam]).map(
          (continuationBody) => C.op(effect, value, continuationParam, continuationBody)
        )
      )
  );

  const ifArb = fc
    .tuple(
      fc.boolean(),
      mkAgreementComputationArb(variables, depth - 1, reserved),
      mkAgreementComputationArb(variables, depth - 1, reserved)
    )
    .map(([condition, thenBranch, elseBranch]) => C.ifThenElse(V.bool(condition), thenBranch, elseBranch));

  const appArb = mkAgreementFunctionValueArb(variables, depth - 1, reserved).chain((fn) =>
    mkAgreementValueArb(variables, Math.max(depth - 1, 0), reserved).map((arg) => C.apply(fn, arg))
  );

  const withArb = mkAgreementHandlerValueArb(variables, depth - 1, reserved).chain((handler) =>
    mkAgreementComputationArb(variables, depth - 1, reserved).map((body) => C.withHandle(handler, body))
  );

  return fc.oneof(retArb, bindArb, opArb, ifArb, appArb, withArb);
};

const mkAgreementValueArb = (variables: readonly string[], depth: number, reserved: readonly string[]): fc.Arbitrary<Value> => {
  const leaves: fc.Arbitrary<Value>[] = [literalValueArb];
  if (variables.length > 0) leaves.push(fc.constantFrom(...variables).map((name) => V.variable(name)));

  if (depth <= 0) return fc.oneof(...leaves);

  return fc.oneof(
    ...leaves,
    mkAgreementFunctionValueArb(variables, depth - 1, reserved),
    mkAgreementHandlerValueArb(variables, depth - 1, reserved)
  );
};

const mkAgreementFunctionValueArb = (
  variables: readonly string[],
  depth: number,
  reserved: readonly string[]
): fc.Arbitrary<Value> =>
  freshNameArbFor(reserved).chain((param) =>
    mkAgreementComputationArb([...variables, param], Math.max(depth, 0), [...reserved, param]).map((body) =>
      V.fun(param, body)
    )
  );

const mkAgreementHandlerValueArb = (
  variables: readonly string[],
  depth: number,
  reserved: readonly string[]
): fc.Arbitrary<HandlerValue> => {
  const returnClauseArb: fc.Arbitrary<HandlerValue["returnClause"]> = fc.oneof(fc.constant(undefined), freshNameArbFor(reserved).chain((param) =>
    mkAgreementComputationArb([...variables, param], Math.max(depth - 1, 0), [...reserved, param]).map((body) => ({
      param,
      body,
    }))
  ));

  const operationsArb = fc
    .uniqueArray(fc.constantFrom(...EFFECT_NAMES), { minLength: 0, maxLength: EFFECT_NAMES.length })
    .chain((effects) =>
      effects.length === 0
        ? fc.constant({})
        : fc
            .tuple(
              ...effects.map((effect) =>
                freshNameArbFor(reserved).chain((arg) =>
                  freshNameArbFor([...reserved, arg]).chain((k) =>
                    mkAgreementComputationArb([...variables, arg, k], Math.max(depth - 1, 0), [...reserved, arg, k]).map(
                      (body) =>
                        [
                          effect,
                          {
                            arg,
                            k,
                            body,
                          },
                        ] as const
                    )
                  )
                )
              )
            )
            .map((entries) => Object.fromEntries(entries))
    );

  return fc.tuple(returnClauseArb, operationsArb).map(([returnClause, operations]) =>
    V.handler({
      returnClause,
      operations,
    })
  );
};

type HandlerFrame = {
  effects: ReadonlySet<string>;
  resumeTagAtom: string;
  abortTagAtom: string;
};

type TranslationState = {
  nextTempId: number;
};

const createTranslationState = (): TranslationState => ({ nextTempId: 0 });

const freshTemp = (state: TranslationState, prefix: string) => `__${prefix}_${state.nextTempId++}`;

const encodeContinuationArg = (resumeExpr: string, callbackName: string, resumeTagAtom: string): string =>
  `${callbackName} ($${resumeTagAtom}, ${resumeExpr})`;

const decodeContinuationArg = (
  effectResultVar: string,
  continuationParam: string,
  continuationComputation: string,
  resumeTagAtom: string
): string =>
  `if $${resumeTagAtom} in ${effectResultVar} { ((fn ${continuationParam} { ${continuationComputation} }) (${effectResultVar}[1])) } else { ${effectResultVar} }`;

const findHandlingFrame = (frames: readonly HandlerFrame[], effect: string): HandlerFrame | undefined => {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].effects.has(effect)) return frames[i];
  }
  return undefined;
};

const propagateIfAborted = (valueExpr: string, frames: readonly HandlerFrame[], whenNotAborted: string): string => {
  let current = whenNotAborted;
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    current = `if $${frame.abortTagAtom} in ${valueExpr} { ${valueExpr} } else { ${current} }`;
  }
  return current;
};

const translateValue = (value: Value, state: TranslationState, frames: readonly HandlerFrame[]): string => {
  switch (value.kind) {
    case "var":
      return value.name;
    case "bool":
      return value.value ? "true" : "false";
    case "int":
      return String(value.value);
    case "fun":
      return `fn ${value.param} { ${translateComputationWithContext(value.body, state, frames)} }`;
    case "handler":
      return translateHandlerRecord(value, state, frames, undefined);
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
};

const translateHandlerRecord = (
  handler: HandlerValue,
  state: TranslationState,
  frames: readonly HandlerFrame[],
  activeFrame: HandlerFrame | undefined
): string => {
  const callbackName = "__callback";
  const resumeParam = "__resume";
  const operationEntries = Object.entries(handler.operations).map(([name, clause]) => {
    const kAlias = activeFrame
      ? `${clause.k} := fn ${resumeParam} { ${encodeContinuationArg(
          resumeParam,
          callbackName,
          activeFrame.resumeTagAtom
        )} }`
      : `${clause.k} := fn ${resumeParam} { ${callbackName} ${resumeParam} }`;
    const clauseBody = translateComputationWithContext(clause.body, state, frames);
    const wrappedClauseBody = activeFrame ? `($${activeFrame.abortTagAtom}, ${clauseBody})` : clauseBody;
    return `${name}: handler fn (${callbackName}, ${clause.arg}) { ${kAlias}; ${wrappedClauseBody} }`;
  });

  const returnEntry = (() => {
    if (!handler.returnClause && !activeFrame) return [];

    const param = handler.returnClause?.param ?? "__return_value";
    const returnBody = handler.returnClause ? translateComputationWithContext(handler.returnClause.body, state, frames) : param;
    const withOuterPropagation = propagateIfAborted(param, frames, returnBody);
    const body = activeFrame
      ? `if $${activeFrame.abortTagAtom} in ${param} { ${param}[1] } else { ${withOuterPropagation} }`
      : withOuterPropagation;

    return [`return_handler: fn ${param} { ${body} }`];
  })();

  const entries = [...operationEntries, ...returnEntry];
  return `record { ${entries.join(", ")} }`;
};

const translateComputationWithContext = (
  term: Computation,
  state: TranslationState,
  frames: readonly HandlerFrame[]
): string => {
  switch (term.kind) {
    case "return":
      return translateValue(term.value, state, frames);
    case "op": {
      const operationValue = translateValue(term.value, state, frames);
      const continuationComputation = translateComputationWithContext(term.continuationBody, state, frames);
      const handlingFrame = findHandlingFrame(frames, term.operation);
      if (!handlingFrame) {
        return `((fn ${term.continuationParam} { ${continuationComputation} }) (handle ($${term.operation}) (${operationValue})))`;
      }

      const effectResultVar = freshTemp(state, "effect_result");
      const decoded = decodeContinuationArg(
        effectResultVar,
        term.continuationParam,
        continuationComputation,
        handlingFrame.resumeTagAtom
      );
      return `((fn ${effectResultVar} { ${decoded} }) (handle ($${term.operation}) (${operationValue})))`;
    }
    case "do":
      return (() => {
        const left = translateComputationWithContext(term.left, state, frames);
        const right = translateComputationWithContext(term.right, state, frames);
        const leftValue = freshTemp(state, "bind_left");
        const bindResult = `((fn ${term.name} { ${right} }) (${leftValue}))`;
        const withAbortPropagation = propagateIfAborted(leftValue, frames, bindResult);
        return `((fn ${leftValue} { ${withAbortPropagation} }) (${left}))`;
      })();
    case "if":
      return `if ${translateValue(term.condition, state, frames)} { ${translateComputationWithContext(term.thenBranch, state, frames)} } else { ${translateComputationWithContext(term.elseBranch, state, frames)} }`;
    case "app":
      return `(${translateValue(term.fn, state, frames)}) (${translateValue(term.arg, state, frames)})`;
    case "with": {
      if (term.handler.kind !== "handler") {
        return `inject ${translateValue(term.handler, state, frames)} { ${translateComputationWithContext(term.body, state, frames)} }`;
      }

      const resumeTagAtom = freshTemp(state, "resume_tag").replace(/^__/, "");
      const abortTagAtom = freshTemp(state, "abort_tag").replace(/^__/, "");
      const currentFrame: HandlerFrame = {
        effects: new Set(Object.keys(term.handler.operations)),
        resumeTagAtom,
        abortTagAtom,
      };
      const handlersRecord = translateHandlerRecord(term.handler, state, frames, currentFrame);
      const body = translateComputationWithContext(term.body, state, [...frames, currentFrame]);
      return `inject ${handlersRecord} { ${body} }`;
    }
    default: {
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
};

export const translateComputation = (term: Computation): string =>
  translateComputationWithContext(term, createTranslationState(), []);

export type ObservedAgreementValue =
  | { kind: "int"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "var"; name: string }
  | { kind: "fun" }
  | { kind: "handler" };

export type ObservedAgreementResult =
  | { kind: "return"; value: ObservedAgreementValue }
  | { kind: "op"; operation: string; value: ObservedAgreementValue };

const observeCoreValue = (value: Value): ObservedAgreementValue => {
  switch (value.kind) {
    case "int":
      return { kind: "int", value: value.value };
    case "bool":
      return { kind: "bool", value: value.value };
    case "var":
      return { kind: "var", name: value.name };
    case "fun":
      return { kind: "fun" };
    case "handler":
      return { kind: "handler" };
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
};

type VmClosure = { functionName: string; env: unknown };
type VmRecord = { record: Record<string, unknown> };
type VmSymbolValue = { symbol: string | number; name?: string };
type VmEffectHandle = { threadId: string; effect: unknown; arg: unknown; continuation: unknown };

const isVmClosure = (value: unknown): value is VmClosure =>
  typeof value === "object" && value !== null && "functionName" in value && "env" in value;

const isVmRecord = (value: unknown): value is VmRecord =>
  typeof value === "object" && value !== null && "record" in value;

const isVmSymbolValue = (value: unknown): value is VmSymbolValue =>
  typeof value === "object" && value !== null && "symbol" in value;

const isVmEffectHandle = (value: unknown): value is VmEffectHandle =>
  typeof value === "object" &&
  value !== null &&
  "threadId" in value &&
  "effect" in value &&
  "arg" in value &&
  "continuation" in value;

const effectNameFromVmValue = (value: unknown): string => {
  if (isVmSymbolValue(value)) {
    if (typeof value.name === "string") return value.name;
    if (typeof value.symbol === "string" && value.symbol.startsWith("atom:")) return value.symbol.slice("atom:".length);
  }
  if (typeof value === "string" && value.startsWith("atom:")) return value.slice("atom:".length);
  if (typeof value === "string") return value;
  throw new Error(`vm effect key is not representable as a core operation name: ${String(value)}`);
};

const observeVmValue = (value: unknown): ObservedAgreementValue => {
  if (typeof value === "number") return { kind: "int", value };
  if (typeof value === "boolean") return { kind: "bool", value };
  if (isVmClosure(value)) return { kind: "fun" };
  if (isVmRecord(value) && Object.values(value.record).every((entry) => isVmClosure(entry))) return { kind: "handler" };
  throw new Error(`vm value is outside observed core value domain: ${String(value)}`);
};

export const observeCoreNormalForm = (term: Computation): ObservedAgreementResult => {
  if (term.kind === "return") return { kind: "return", value: observeCoreValue(term.value) };
  if (term.kind === "op") return { kind: "op", operation: term.operation, value: observeCoreValue(term.value) };
  throw new Error("expected return or operation normal form");
};

export const observeVmResult = (result: unknown): ObservedAgreementResult => {
  if (isVmEffectHandle(result)) {
    return {
      kind: "op",
      operation: effectNameFromVmValue(result.effect),
      value: observeVmValue(result.arg),
    };
  }
  return {
    kind: "return",
    value: observeVmValue(result),
  };
};

export const pureComputationArb = (maxDepth = 3, variables: readonly string[] = []) =>
  mkPureComputationArb(variables, maxDepth, [...variables]);

export const pureValueArb = (maxDepth = 2, variables: readonly string[] = []) =>
  mkPureValueArb(variables, maxDepth, [...variables]);

export const translatableComputationArb = (maxDepth = 3) =>
  mkAgreementComputationArb([], maxDepth, []);

export const effectNameArb = fc.constantFrom(...EFFECT_NAMES);
