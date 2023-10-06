import { parseTokens } from "./parser/tokens.js";
import {
  ConsumeParsingResult,
  ParsingError,
  ParsingResult,
  Token,
} from "./parser/types.js";
import { Iterator } from "./utils.js";

const next = (src: Token[], i: number): ParsingResult<Token> => {
  if (!src[i]) return [i + 1, src[i], [{ message: "end of tokens" }]];
  return [i + 1, src[i], []];
};
const newlineNext = (src: Token[], i: number): ParsingResult<Token> => {
  if (!src[i]) return [i + 1, src[i], [{ message: "end of tokens" }]];
  if (src[i].type === "newline") i++;
  return [i + 1, src[i], []];
};

export enum TermKind {
  Binding = "binding",
  Variable = "variable",
  Value = "value",
  Application = "application",
  Binder = "binder",
  Pattern = "pattern",
  PatternName = "patternName",
}

export type BindingTerm = {
  kind: TermKind.Binding;
  name: string;
  index: number;
};
export type ApplicationTerm = {
  kind: TermKind.Application;
  fn: Term;
  arg: Term;
};
export type BinderTerm = {
  kind: TermKind.Binder;
  body: Term;
};
export type ValueTerm = { kind: TermKind.Value; value: any };
export type PatternTerm =
  | { kind: TermKind.Pattern; patterns: PatternTerm[] }
  | { kind: TermKind.PatternName; name: string };

export type Term = ValueTerm | BindingTerm | ApplicationTerm | BinderTerm;

export type BlockStatement = {
  operator?: Term;
  recursive?: boolean;
  name?: PatternTerm;
  value: Term;
};

export const resolveNames = (term: Term, context: string[] = []): Term => {
  switch (term.kind) {
    case TermKind.Binder:
      return {
        ...term,
        body: resolveNames(term.body, ["", ...context]),
      };
    case TermKind.Application:
      return {
        ...term,
        arg: resolveNames(term.arg, context),
        fn: resolveNames(term.fn, context),
      };
    case TermKind.Binding:
      if (term.index === -1) return term;
      const index = context.indexOf(term.name);
      return { kind: TermKind.Binding, name: term.name, index };
    case TermKind.Value:
      return term;
  }
};

export const fun = (body: any, names: PatternTerm[] = []) =>
  names.reduceRight((acc, value) => {
    if (value.kind === TermKind.PatternName)
      return fun(resolveNames(acc, [value.name]));
    else
      return block(
        value.patterns.map((pattern, i, arr) => ({
          value: app(nth(i, arr.length), binding(0)),
          name: pattern,
        })),
        acc
      );
  }, body);
export const app = (fn: Term, arg: Term) => ({
  kind: TermKind.Application as const,
  fn,
  arg,
});
export const variable = (name: string) => ({
  kind: TermKind.Binding as const,
  name,
  index: -1,
});
export const binding = (index: number, name = "") => ({
  kind: TermKind.Binding as const,
  index,
  name,
});
export const patternName = (name: string) => ({
  kind: TermKind.PatternName as const,
  name,
});
export const pattern = (patterns: PatternTerm[]) => ({
  kind: TermKind.Pattern as const,
  patterns,
});
export const value = (value: any) => ({ kind: TermKind.Value as const, value });
const appAll = (fn: any, ...args: any[]) =>
  Iterator.iter(args).reduce((acc, v) => app(acc, v), fn);
const rec = fun(app(binding(0), binding(0)));
const fix = fun(app(rec, fun(app(binding(1), app(binding(0), binding(0))))));
const block = (statements: BlockStatement[], result: any, operator?: any) =>
  statements.reduceRight((acc, val) => {
    let value = val.value;
    if (val.recursive) {
      if (val.name) value = fun(value, [val.name]);
      else value = fun(value);
      value = app(fix, value);
    }

    if (val.name) acc = fun(acc, [val.name]);
    else acc = fun(acc);

    if (val.operator) acc = app(val.operator, acc);
    else if (operator) acc = app(operator, acc);

    return app(acc, value);
  }, result);
const nth = (n: number, total = n + 1) =>
  fun(variable("x" + n), [
    ...Iterator.natural(total).map((x) => patternName("x" + x)),
  ]);
const tuple = (size: number) =>
  fun(fun(appAll(binding(0), ...Iterator.natural(size).map((x) => "x" + x))), [
    ...Iterator.natural(size).map((x) => patternName("x" + x)),
  ]);
const id = fun(binding(0));

export const replace = (
  term: Term,
  value: Term,
  index = 0
): [result: Term, replaced: boolean] => {
  switch (term.kind) {
    case TermKind.Binder:
      const [result, replaced] = replace(term.body, value, index + 1);
      if (replaced) return [{ ...term, body: result }, true];

      return [term, false];
    case TermKind.Application:
      const [resultFn, replacedFn] = replace(term.fn, value, index);
      const [resultArg, replacedArg] = replace(term.arg, value, index);
      return [
        { ...term, fn: resultFn, arg: resultArg },
        replacedFn || replacedArg,
      ];
    case TermKind.Binding:
      if (index === term.index) return [value, true];
      else return [term, false];
    case TermKind.Value:
      return [term, false];
  }
};

export const evaluateStepApplication = (
  term: Term
): [result: Term, evaluated: boolean] => {
  switch (term.kind) {
    case TermKind.Application:
      if (term.fn.kind === TermKind.Binder) {
        const [result] = replace(term.fn.body, term.arg);
        return [result, true];
      }

      const [resultFn, reducedFn] = evaluateStepApplication(term.fn);
      if (reducedFn) return [{ ...term, fn: resultFn }, true];

      const [resultArg, reducedArg] = evaluateStepApplication(term.arg);
      if (reducedArg) return [{ ...term, arg: resultArg }, true];

      return [term, false];
    case TermKind.Value:
    case TermKind.Binder:
    case TermKind.Binding:
      return [term, false];
  }
};

export const evaluateStepFunction = (
  term: Term
): [result: Term, evaluated: boolean] => {
  switch (term.kind) {
    case TermKind.Binder:
      if (term.body.kind === TermKind.Application) {
        const { arg, fn } = term.body;
        if (arg.kind === TermKind.Binding && arg.index === 0) return [fn, true];
      }

      const [body, reduced] = evaluateStepFunction(term.body);
      if (reduced) return [{ ...term, body }, true];

      return [term, false];
    case TermKind.Application:
      const [fn, reducedFn] = evaluateStepFunction(term.fn);
      if (reducedFn) return [{ ...term, fn }, true];

      const [arg, reducedArg] = evaluateStepFunction(term.arg);
      if (reducedArg) return [{ ...term, arg }, true];

      return [term, false];
    case TermKind.Value:
    case TermKind.Binding:
      return [term, false];
  }
};

export const evaluateStep = (
  term: Term
): [result: Term, evaluated: boolean] => {
  const [resultApplication, reducedApplication] = evaluateStepApplication(term);
  if (reducedApplication) return [resultApplication, true];

  const [resultFunction, reducedFunction] = evaluateStepFunction(term);
  if (reducedFunction) return [resultFunction, true];

  return [term, false];
};

export const evaluate = (term: Term): Term => {
  let evaluated = true;
  while (evaluated) [term, evaluated] = evaluateStep(term);
  return term;
};

export const evaluateCost = (term: Term): [result: Term, cost: number] => {
  let evaluated = true;
  let cost = 0;
  while (evaluated) {
    [term, evaluated] = evaluateStep(term);
    if (evaluated) cost++;
  }
  return [term, cost];
};

export const insertContext = (
  term: Term,
  [head, ...rest]: Term[] = []
): Term => {
  if (!head) return term;

  [term] = replace(term, head, rest.length + 1);
  return insertContext(term, rest);
};

export const print = (term: Term): string => {
  switch (term.kind) {
    case TermKind.Binder:
      return `fn -> ${print(term.body)}`;
    case TermKind.Application:
      return `(${print(term.fn)}) (${print(term.arg)})`;
    case TermKind.Binding:
      return `#${term.index}`;
    case TermKind.Value:
      return `${term.value}`;
  }
};

export const insertEnv = (term: Term, env: Record<string, Term> = {}): Term => {
  const entries = Object.entries(env);
  const keys = entries.map(([key]) => key);
  const values = entries.map(([, term], i) =>
    resolveNames(term, keys.slice(-i))
  );

  return insertContext(resolveNames(term, keys), values);
};

function getAllNames(pattern: PatternTerm): string[] {
  if (pattern.kind === TermKind.PatternName) return [pattern.name];
  else return pattern.patterns.flatMap((pattern) => getAllNames(pattern));
}

function getUnboundNames(term: Term): string[] {
  switch (term.kind) {
    case TermKind.Binder:
      return getUnboundNames(term.body);
    case TermKind.Application:
      return [...getUnboundNames(term.arg), ...getUnboundNames(term.fn)];
    case TermKind.Binding:
      if (term.index === -1) return [term.name];
      return [];
    case TermKind.Value:
      return [];
  }
}

const isRecursive = (pattern: PatternTerm, body: Term) => {
  const boundNames = getAllNames(pattern);
  const unboundNames = getUnboundNames(body);

  return unboundNames.some((name) => boundNames.includes(name));
};

export const parsePattern = (
  src: Token[],
  i = 0
): ParsingResult<PatternTerm> => {
  let index = i;
  const errors: ParsingError[] = [];

  if (src[index].src === "(") {
    [index] = newlineNext(src, index);

    const patterns: PatternTerm[] = [];

    while (src[index].src === ",") {
      [index] = newlineNext(src, index);

      const [nextIndex, body, _errors] = parsePattern(src, index);
      index = nextIndex;
      errors.push(..._errors);
      patterns.push(body);
    }

    if (src[index].src === ")") {
      [index] = newlineNext(src, index);
      return [index, { kind: TermKind.Pattern, patterns }, errors];
    }
  }

  const token = src[index];
  [index] = newlineNext(src, index);
  if (token.type === "identifier")
    return [index, { kind: TermKind.PatternName, name: token.src }, errors];
  return [
    index,
    { kind: TermKind.PatternName, name: "_" },
    [{ message: "can't put values in patterns" }, ...errors],
  ];
};

export const parseTerm = (src: Token[], i = 0): ParsingResult<Term> => {
  let index = i;
  const errors: ParsingError[] = [];

  if (src[index]?.type === "newline") index++;

  if (src[index].src === "fn") {
    [index] = newlineNext(src, index);
    const names: PatternTerm[] = [];

    while (src[index]) {
      if (src[index].src === "->") {
        [index] = newlineNext(src, index);
        break;
      }

      const [nextIndex, pat, _errors] = parsePattern(src, index);
      names.push(pat);
      index = nextIndex;
      errors.push(..._errors);

      if (src[index].src === ",") index++;
      if (src[index]?.type === "newline") index++;
    }

    const [nextIndex, body, _errors] = parseApplication(src, index, [")"]);
    index = nextIndex;
    errors.push(..._errors);

    if (!body) errors.push({ message: "no body" });

    return [index, fun(body, names), errors];
  }

  if (src[index].src === "(") {
    [index] = newlineNext(src, index);

    const [nextIndex, body, _errors] = parseApplication(src, index, [")", ","]);
    index = nextIndex;
    errors.push(..._errors);
    const tupleItems: Term[] = [];

    if (src[index].src === ",") {
      [index] = newlineNext(src, index);
      if (body) tupleItems.push(body);
      let _body: Term | null = null;

      while (src[index].src === ",") {
        [index] = newlineNext(src, index);
        if (_body) tupleItems.push(_body);

        const [nextIndex, body, _errors] = parseApplication(src, index, [
          ")",
          ",",
        ]);
        index = nextIndex;
        errors.push(..._errors);
        _body = body;
      }

      if (_body) tupleItems.push(_body);
    }

    if (src[index].src === ")") {
      [index] = newlineNext(src, index);
      if (tupleItems.length > 0)
        return [index, appAll(tuple(tupleItems.length), ...tupleItems), errors];
      if (!body) return [index, id, errors];

      return [index, body, errors];
    }
  }

  if (src[index].src === "{") {
    [index] = newlineNext(src, index);
    let result: Term | null = null;
    const statements: BlockStatement[] = [];
    while (src[index].src !== "}") {
      let operator: Term | null = null;
      if (src[index].src === "with") {
        [index] = newlineNext(src, index);
        const [nextIndex, result, _errors] = parseTerm(src, index);

        index = nextIndex;
        errors.push(..._errors);
        operator = result;
      }
      const recursive =
        src[index].src === "recursive"
          ? (index++, src[index]?.type === "newline" ? index++ : null, true)
          : false;

      let pat: PatternTerm | null = null;
      {
        const [nextIndex, _pat, _errors] = parsePattern(src, index);

        if (src[nextIndex].src === ":=") {
          index = nextIndex;
          [index] = newlineNext(src, index);
          errors.push(..._errors);
          pat = _pat;
        }
      }

      const banned = [";", "\n", "}"];
      const [nextIndex, value, _errors] = parseApplication(src, index, banned);

      index = nextIndex;
      errors.push(..._errors);

      if (src[index].src !== "}") index++;
      if (src[index]?.type === "newline") index++;

      if (operator && !pat) {
        errors.push({ message: 'must bind if using "with" clause' });
        continue;
      }
      if (!value) {
        errors.push({ message: "can't parse value term" });
        continue;
      }

      const statement: (typeof statements)[number] = { value };
      result = value;

      if (pat) statement.name = pat;
      if (operator) statement.operator = operator;
      statement.recursive =
        recursive || (!!pat && isRecursive(pat, statement.value));
      statements.push(statement);
    }
    index++;
    if (!result) errors.push({ message: "empty blocks are forbidden" });
    statements.pop(); // result statement is pushed also, pop it
    return [index, block(statements, result), errors];
  }

  if (src[index].src === "do") {
    [index] = newlineNext(src, index);
    const [nextIndex, operator, _errors] = parseTerm(src, index);
    errors.push(..._errors);
    index = nextIndex;

    if (src[index].src === "{") {
      [index] = newlineNext(src, index);
      let result: Term | null = null;
      const statements: BlockStatement[] = [];
      while (src[index].src !== "}") {
        let operator: Term | null = null;
        if (src[index].src === "with") {
          [index] = newlineNext(src, index);
          const [nextIndex, result, _errors] = parseTerm(src, index);

          index = nextIndex;
          errors.push(..._errors);
          operator = result;
        }
        const recursive =
          src[index].src === "recursive"
            ? (index++, src[index]?.type === "newline" ? index++ : null, true)
            : false;

        let pat: PatternTerm | null = null;
        {
          const [nextIndex, _pat, _errors] = parsePattern(src, index);

          if (src[nextIndex].src === "=") {
            index = nextIndex;
            [index] = newlineNext(src, index);
            errors.push(..._errors);
            pat = _pat;
          }
        }

        const banned = [";", "\n", "}"];
        const [nextIndex, value, _errors] = parseApplication(
          src,
          index,
          banned
        );

        index = nextIndex;
        errors.push(..._errors);

        if (src[index].src !== "}") index++;
        if (src[index]?.type === "newline") index++;

        if (operator && !pat) {
          errors.push({ message: 'must bind if using "with" clause' });
          continue;
        }
        if (!value) {
          errors.push({ message: "can't parse value term" });
          continue;
        }

        const statement: (typeof statements)[number] = { value };
        result = value;

        if (pat) statement.name = pat;
        if (operator) statement.operator = operator;
        statement.recursive =
          recursive || (!!pat && isRecursive(pat, statement.value));
        statements.push(statement);
      }
      index++;
      if (!result) errors.push({ message: "empty blocks are forbidden" });
      statements.pop(); // result statement is pushed also, pop it
      return [index, block(statements, result, operator), errors];
    } else {
      errors.push({ message: "do clause must have block to execute" });
      while (src[index].type !== "newline") index++;
      index++;
      return [index, block([], id, operator), errors];
    }
  }

  const token = src[index];
  [index] = newlineNext(src, index);
  if (token.type === "identifier") return [index, variable(token.src), errors];
  if (token.type === "number" || token.type === "string")
    return [index, value(token.value), errors];
  throw new Error("unreachable"); // ts is stoopid
};

export const parseApplication = (
  src: Token[],
  i = 0,
  banned: string[] = []
): ParsingResult<Term | null> => {
  let index = i;
  const errors: ParsingError[] = [];

  let body: Term | null = null;
  while (src[index]) {
    if (banned.includes("\n") && src[index]?.type === "newline") break;
    if (banned.includes(src[index].src)) break;
    const [nextIndex, term, _errors] = parseTerm(src, index);

    index = nextIndex;
    errors.push(..._errors);

    if (
      body?.kind === TermKind.Binding &&
      body.name === "#" &&
      term.kind === TermKind.Value &&
      typeof term.value === "number"
    )
      body = binding(term.value);
    else if (body) body = app(body, term);
    else body = term;
  }

  return [index, body, errors];
};

export const parse = (src: string, i = 0): ConsumeParsingResult<Term> => {
  const [tokens, errors] = parseTokens(src, i);
  const [, term, _errors] = parseApplication(tokens);
  errors.push(..._errors);

  if (!term)
    return [binding(0), [{ message: "cant parse any terms" }, ...errors]];

  return [term, errors];
};
