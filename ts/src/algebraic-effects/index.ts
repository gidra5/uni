export type VariableValue = {
  kind: "var";
  name: string;
};

export type BooleanValue = {
  kind: "bool";
  value: boolean;
};

export type IntegerValue = {
  kind: "int";
  value: number;
};

export type FunctionValue = {
  kind: "fun";
  param: string;
  body: Computation;
};

export type OperationClause = {
  arg: string;
  k: string;
  body: Computation;
};

export type ReturnClause = {
  param: string;
  body: Computation;
};

export type HandlerValue = {
  kind: "handler";
  returnClause?: ReturnClause;
  operations: Record<string, OperationClause>;
};

export type Value = VariableValue | BooleanValue | IntegerValue | FunctionValue | HandlerValue;

export type ReturnComputation = {
  kind: "return";
  value: Value;
};

export type OperationComputation = {
  kind: "op";
  operation: string;
  value: Value;
  continuationParam: string;
  continuationBody: Computation;
};

export type BindComputation = {
  kind: "do";
  name: string;
  left: Computation;
  right: Computation;
};

export type IfComputation = {
  kind: "if";
  condition: Value;
  thenBranch: Computation;
  elseBranch: Computation;
};

export type ApplyComputation = {
  kind: "app";
  fn: Value;
  arg: Value;
};

export type WithComputation = {
  kind: "with";
  handler: Value;
  body: Computation;
};

export type Computation =
  | ReturnComputation
  | OperationComputation
  | BindComputation
  | IfComputation
  | ApplyComputation
  | WithComputation;

type HandlerSpec = {
  returnClause?: ReturnClause;
  operations?: Record<string, OperationClause>;
};

const cloneValue = (value: Value): Value => {
  switch (value.kind) {
    case "var":
      return { ...value };
    case "bool":
      return { ...value };
    case "int":
      return { ...value };
    case "fun":
      return { kind: "fun", param: value.param, body: cloneComputation(value.body) };
    case "handler": {
      const operations: Record<string, OperationClause> = {};
      for (const [operation, clause] of Object.entries(value.operations)) {
        operations[operation] = {
          arg: clause.arg,
          k: clause.k,
          body: cloneComputation(clause.body),
        };
      }
      return {
        kind: "handler",
        returnClause: value.returnClause
          ? {
              param: value.returnClause.param,
              body: cloneComputation(value.returnClause.body),
            }
          : undefined,
        operations,
      };
    }
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
};

const cloneComputation = (term: Computation): Computation => {
  switch (term.kind) {
    case "return":
      return { kind: "return", value: cloneValue(term.value) };
    case "op":
      return {
        kind: "op",
        operation: term.operation,
        value: cloneValue(term.value),
        continuationParam: term.continuationParam,
        continuationBody: cloneComputation(term.continuationBody),
      };
    case "do":
      return {
        kind: "do",
        name: term.name,
        left: cloneComputation(term.left),
        right: cloneComputation(term.right),
      };
    case "if":
      return {
        kind: "if",
        condition: cloneValue(term.condition),
        thenBranch: cloneComputation(term.thenBranch),
        elseBranch: cloneComputation(term.elseBranch),
      };
    case "app":
      return {
        kind: "app",
        fn: cloneValue(term.fn),
        arg: cloneValue(term.arg),
      };
    case "with":
      return {
        kind: "with",
        handler: cloneValue(term.handler),
        body: cloneComputation(term.body),
      };
    default: {
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
};

export const values = {
  variable: (name: string): VariableValue => ({ kind: "var", name }),
  bool: (value: boolean): BooleanValue => ({ kind: "bool", value }),
  integer: (value: number): IntegerValue => ({ kind: "int", value }),
  fun: (param: string, body: Computation): FunctionValue => ({ kind: "fun", param, body: cloneComputation(body) }),
  handler: (spec: HandlerSpec): HandlerValue => ({
    kind: "handler",
    returnClause: spec.returnClause
      ? { param: spec.returnClause.param, body: cloneComputation(spec.returnClause.body) }
      : undefined,
    operations: Object.fromEntries(
      Object.entries(spec.operations ?? {}).map(([operation, clause]) => [
        operation,
        { arg: clause.arg, k: clause.k, body: cloneComputation(clause.body) },
      ])
    ),
  }),
};

export const computations = {
  ret: (value: Value): ReturnComputation => ({ kind: "return", value: cloneValue(value) }),
  op: (
    operation: string,
    value: Value,
    continuationParam: string,
    continuationBody: Computation
  ): OperationComputation => ({
    kind: "op",
    operation,
    value: cloneValue(value),
    continuationParam,
    continuationBody: cloneComputation(continuationBody),
  }),
  bind: (name: string, left: Computation, right: Computation): BindComputation => ({
    kind: "do",
    name,
    left: cloneComputation(left),
    right: cloneComputation(right),
  }),
  ifThenElse: (condition: Value, thenBranch: Computation, elseBranch: Computation): IfComputation => ({
    kind: "if",
    condition: cloneValue(condition),
    thenBranch: cloneComputation(thenBranch),
    elseBranch: cloneComputation(elseBranch),
  }),
  apply: (fn: Value, arg: Value): ApplyComputation => ({
    kind: "app",
    fn: cloneValue(fn),
    arg: cloneValue(arg),
  }),
  withHandle: (handler: Value, body: Computation): WithComputation => ({
    kind: "with",
    handler: cloneValue(handler),
    body: cloneComputation(body),
  }),
};

const substituteValue = (target: Value, variable: string, replacement: Value): Value => {
  switch (target.kind) {
    case "var":
      return target.name === variable ? cloneValue(replacement) : cloneValue(target);
    case "bool":
      return cloneValue(target);
    case "int":
      return cloneValue(target);
    case "fun":
      if (target.param === variable) return cloneValue(target);
      return values.fun(target.param, substituteComputation(target.body, variable, replacement));
    case "handler": {
      const returnClause =
        target.returnClause && target.returnClause.param !== variable
          ? {
              param: target.returnClause.param,
              body: substituteComputation(target.returnClause.body, variable, replacement),
            }
          : target.returnClause
            ? {
                param: target.returnClause.param,
                body: cloneComputation(target.returnClause.body),
              }
            : undefined;

      const operations: Record<string, OperationClause> = {};
      for (const [operation, clause] of Object.entries(target.operations)) {
        const shadowed = clause.arg === variable || clause.k === variable;
        operations[operation] = {
          arg: clause.arg,
          k: clause.k,
          body: shadowed ? cloneComputation(clause.body) : substituteComputation(clause.body, variable, replacement),
        };
      }

      return values.handler({ returnClause, operations });
    }
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
};

export const substituteComputation = (term: Computation, variable: string, replacement: Value): Computation => {
  switch (term.kind) {
    case "return":
      return computations.ret(substituteValue(term.value, variable, replacement));
    case "op":
      return computations.op(
        term.operation,
        substituteValue(term.value, variable, replacement),
        term.continuationParam,
        term.continuationParam === variable
          ? cloneComputation(term.continuationBody)
          : substituteComputation(term.continuationBody, variable, replacement)
      );
    case "do":
      return computations.bind(
        term.name,
        substituteComputation(term.left, variable, replacement),
        term.name === variable ? cloneComputation(term.right) : substituteComputation(term.right, variable, replacement)
      );
    case "if":
      return computations.ifThenElse(
        substituteValue(term.condition, variable, replacement),
        substituteComputation(term.thenBranch, variable, replacement),
        substituteComputation(term.elseBranch, variable, replacement)
      );
    case "app":
      return computations.apply(
        substituteValue(term.fn, variable, replacement),
        substituteValue(term.arg, variable, replacement)
      );
    case "with":
      return computations.withHandle(
        substituteValue(term.handler, variable, replacement),
        substituteComputation(term.body, variable, replacement)
      );
    default: {
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
};

export type ReductionRule =
  | "Do-Context"
  | "With-Context"
  | "Do-Return"
  | "Do-Op"
  | "If-True"
  | "If-False"
  | "App-Beta"
  | "Handle-Return"
  | "Handle-Op-Match"
  | "Handle-Op-Forward";

export type OneStepReduction = {
  rule: ReductionRule;
  term: Computation;
};

const resolveReturnClause = (handler: HandlerValue, value: Value): Computation => {
  if (!handler.returnClause) return computations.ret(value);
  return substituteComputation(handler.returnClause.body, handler.returnClause.param, value);
};

export const stepComputation = (term: Computation): OneStepReduction | null => {
  switch (term.kind) {
    case "do": {
      const leftStep = stepComputation(term.left);
      if (leftStep) {
        return {
          rule: "Do-Context",
          term: computations.bind(term.name, leftStep.term, term.right),
        };
      }

      if (term.left.kind === "return") {
        return {
          rule: "Do-Return",
          term: substituteComputation(term.right, term.name, term.left.value),
        };
      }

      if (term.left.kind === "op") {
        return {
          rule: "Do-Op",
          term: computations.op(
            term.left.operation,
            term.left.value,
            term.left.continuationParam,
            computations.bind(term.name, term.left.continuationBody, term.right)
          ),
        };
      }

      return null;
    }

    case "with": {
      const bodyStep = stepComputation(term.body);
      if (bodyStep) {
        return {
          rule: "With-Context",
          term: computations.withHandle(term.handler, bodyStep.term),
        };
      }

      if (term.handler.kind !== "handler") return null;

      if (term.body.kind === "return") {
        return {
          rule: "Handle-Return",
          term: resolveReturnClause(term.handler, term.body.value),
        };
      }

      if (term.body.kind === "op") {
        const clause = term.handler.operations[term.body.operation];
        if (!clause) {
          return {
            rule: "Handle-Op-Forward",
            term: computations.op(
              term.body.operation,
              term.body.value,
              term.body.continuationParam,
              computations.withHandle(term.handler, term.body.continuationBody)
            ),
          };
        }

        const resumed = values.fun(
          term.body.continuationParam,
          computations.withHandle(term.handler, term.body.continuationBody)
        );
        const withArg = substituteComputation(clause.body, clause.arg, term.body.value);
        const withContinuation = substituteComputation(withArg, clause.k, resumed);
        return {
          rule: "Handle-Op-Match",
          term: withContinuation,
        };
      }

      return null;
    }

    case "if":
      if (term.condition.kind === "bool") {
        return {
          rule: term.condition.value ? "If-True" : "If-False",
          term: term.condition.value ? cloneComputation(term.thenBranch) : cloneComputation(term.elseBranch),
        };
      }
      return null;

    case "app":
      if (term.fn.kind === "fun") {
        return {
          rule: "App-Beta",
          term: substituteComputation(term.fn.body, term.fn.param, term.arg),
        };
      }
      return null;

    case "return":
    case "op":
      return null;

    default: {
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
};

export type ReductionTraceStep = {
  rule: ReductionRule;
  before: Computation;
  after: Computation;
};

export type NormalizationResult = {
  term: Computation;
  steps: ReductionTraceStep[];
  haltedBecause: "normal-form" | "max-steps";
};

export const normalizeComputation = (term: Computation, maxSteps = 1000): NormalizationResult => {
  let current = cloneComputation(term);
  const steps: ReductionTraceStep[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const reduced = stepComputation(current);
    if (!reduced) {
      return {
        term: current,
        steps,
        haltedBecause: "normal-form",
      };
    }
    steps.push({
      rule: reduced.rule,
      before: current,
      after: reduced.term,
    });
    current = reduced.term;
  }

  return {
    term: current,
    steps,
    haltedBecause: "max-steps",
  };
};

export const valueEquals = (left: Value, right: Value): boolean => {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "var":
      return right.kind === "var" && left.name === right.name;
    case "bool":
      return right.kind === "bool" && left.value === right.value;
    case "int":
      return right.kind === "int" && left.value === right.value;
    case "fun":
      return (
        right.kind === "fun" &&
        left.param === right.param &&
        computationEquals(left.body, right.body)
      );
    case "handler": {
      if (right.kind !== "handler") return false;
      const leftHasReturn = Boolean(left.returnClause);
      const rightHasReturn = Boolean(right.returnClause);
      if (leftHasReturn !== rightHasReturn) return false;
      if (left.returnClause && right.returnClause) {
        if (left.returnClause.param !== right.returnClause.param) return false;
        if (!computationEquals(left.returnClause.body, right.returnClause.body)) return false;
      }

      const leftOps = Object.keys(left.operations).sort();
      const rightOps = Object.keys(right.operations).sort();
      if (leftOps.length !== rightOps.length) return false;
      for (let i = 0; i < leftOps.length; i++) {
        if (leftOps[i] !== rightOps[i]) return false;
      }

      for (const op of leftOps) {
        const leftClause = left.operations[op];
        const rightClause = right.operations[op];
        if (!rightClause) return false;
        if (leftClause.arg !== rightClause.arg) return false;
        if (leftClause.k !== rightClause.k) return false;
        if (!computationEquals(leftClause.body, rightClause.body)) return false;
      }
      return true;
    }
    default: {
      const _exhaustive: never = left;
      return _exhaustive;
    }
  }
};

export const computationEquals = (left: Computation, right: Computation): boolean => {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "return":
      return right.kind === "return" && valueEquals(left.value, right.value);
    case "op":
      return (
        right.kind === "op" &&
        left.operation === right.operation &&
        valueEquals(left.value, right.value) &&
        left.continuationParam === right.continuationParam &&
        computationEquals(left.continuationBody, right.continuationBody)
      );
    case "do":
      return (
        right.kind === "do" &&
        left.name === right.name &&
        computationEquals(left.left, right.left) &&
        computationEquals(left.right, right.right)
      );
    case "if":
      return (
        right.kind === "if" &&
        valueEquals(left.condition, right.condition) &&
        computationEquals(left.thenBranch, right.thenBranch) &&
        computationEquals(left.elseBranch, right.elseBranch)
      );
    case "app":
      return right.kind === "app" && valueEquals(left.fn, right.fn) && valueEquals(left.arg, right.arg);
    case "with":
      return right.kind === "with" && valueEquals(left.handler, right.handler) && computationEquals(left.body, right.body);
    default: {
      const _exhaustive: never = left;
      return _exhaustive;
    }
  }
};

export const equivalentByNormalization = (left: Computation, right: Computation, maxSteps = 1000) => {
  const leftResult = normalizeComputation(left, maxSteps);
  const rightResult = normalizeComputation(right, maxSteps);
  return {
    equal: computationEquals(leftResult.term, rightResult.term),
    leftNormalForm: leftResult.term,
    rightNormalForm: rightResult.term,
    leftTrace: leftResult.steps,
    rightTrace: rightResult.steps,
  };
};
