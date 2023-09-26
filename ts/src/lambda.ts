import { parseTokens } from "./parser/tokens.js";
import {
  ConsumeParsingResult,
  ParsingError,
  ParsingResult,
  Token,
} from "./parser/types.js";
import { Iterator } from "./utils.js";

export enum TermKind {
  Binding = "binding",
  Variable = "variable",
  Value = "value",
  Application = "application",
  Binder = "binder",
  Function = "function",
  FunctionWithArgs = "functionWithArgs",
  Block = "block",
  Pattern = "pattern",
  PatternName = "patternName",
}

export type VariableTerm = { kind: TermKind.Variable; name: string };
export type BindingTerm = { kind: TermKind.Binding; index: number };
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

export type Term = ValueTerm | BindingTerm | ApplicationTerm | BinderTerm;

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
  console.dir({ term, evaluated }, { depth: null });
  while (evaluated) {
    [term, evaluated] = evaluateStep(term);
    console.dir({ term, evaluated }, { depth: null });
  }
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

export const insertContext = (term: Term, [...context]: Term[] = []): Term => {
  while (context.length > 0) {
    const value = context.shift();
    if (!value) break;
    [term] = replace(term, value, context.length + 1);
  }

  return term;
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

export type ApplicationTerm2 = {
  kind: TermKind.Application;
  fn: Term2;
  arg: Term2;
};
export type BinderTerm2 = {
  kind: TermKind.Binder;
  body: Term2;
};
export type FunctionTerm = {
  kind: TermKind.Function;
  name: string;
  body: Term2;
};
export type Term2 =
  | ValueTerm
  | FunctionTerm
  | VariableTerm
  | BindingTerm
  | ApplicationTerm2
  | BinderTerm2;

export const eraseNames = (term: Term2, context: string[] = []): Term => {
  switch (term.kind) {
    case TermKind.Binder:
      return {
        ...term,
        body: eraseNames(term.body, ["", ...context]),
      };
    case TermKind.Function:
      return {
        kind: TermKind.Binder,
        body: eraseNames(term.body, [term.name, ...context]),
      };
    case TermKind.Application:
      return {
        ...term,
        arg: eraseNames(term.arg, context),
        fn: eraseNames(term.fn, context),
      };
    case TermKind.Variable:
      const index = context.indexOf(term.name);
      return { kind: TermKind.Binding, index };
    case TermKind.Value:
    case TermKind.Binding:
      return term;
  }
};

export const insertEnv = (
  term: Term2,
  env: Record<string, Term2> = {}
): Term => {
  const entries = Object.entries(env);
  const keys = entries.map(([key]) => key);
  const values = entries.map(([, term], i) => eraseNames(term, keys.slice(-i)));

  return insertContext(eraseNames(term, keys), values);
};

export type ApplicationTerm3 = {
  kind: TermKind.Application;
  fn: Term3;
  arg: Term3;
};
export type BinderTerm3 = {
  kind: TermKind.Binder;
  body: Term3;
};
export type FunctionWithArgsTerm = {
  kind: TermKind.FunctionWithArgs;
  names: string[];
  body: Term3;
};

export type Term3 =
  | ValueTerm
  | FunctionWithArgsTerm
  | VariableTerm
  | BindingTerm
  | ApplicationTerm3
  | BinderTerm3;

export const eraseFunctionWithArgs = (term: Term3): Term2 => {
  switch (term.kind) {
    case TermKind.Binder:
      return {
        ...term,
        body: eraseFunctionWithArgs(term.body),
      };
    case TermKind.FunctionWithArgs:
      return term.names.reduce(
        (acc, name) => ({ kind: TermKind.Function, name, body: acc }),
        eraseFunctionWithArgs(term.body)
      );
    case TermKind.Application:
      return {
        ...term,
        arg: eraseFunctionWithArgs(term.arg),
        fn: eraseFunctionWithArgs(term.fn),
      };
    case TermKind.Value:
    case TermKind.Variable:
    case TermKind.Binding:
      return term;
  }
};

export type ApplicationTerm4 = {
  kind: TermKind.Application;
  fn: Term4;
  arg: Term4;
};
export type BinderTerm4 = {
  kind: TermKind.Binder;
  body: Term4;
};
export type FunctionWithArgsTerm4 = {
  kind: TermKind.FunctionWithArgs;
  names: string[];
  body: Term4;
};
export type BlockTerm = {
  kind: TermKind.Block;
  operator?: Term4;
  statements: {
    operator?: Term4;
    recursive?: boolean;
    name?: string;
    value: Term4;
  }[];
  result: Term4;
};
export type Term4 =
  | ValueTerm
  | BlockTerm
  | FunctionWithArgsTerm4
  | VariableTerm
  | BindingTerm
  | ApplicationTerm4
  | BinderTerm4;

const fun = (names: any[], body: any) => ({
  kind: TermKind.FunctionWithArgs as const,
  names,
  body,
});
const bind = (body: any) => ({ kind: TermKind.Binder as const, body });
const app = (fn: any, arg: any) => ({
  kind: TermKind.Application as const,
  fn,
  arg,
});
const appAll = (fn: any, ...args: any[]) =>
  Iterator.iter(args).reduce((acc, v) => app(acc, v), fn);
const variable = (name: string) => ({ kind: TermKind.Variable as const, name });
const binding = (index: number) => ({ kind: TermKind.Binding as const, index });
const rec = bind(app(binding(0), binding(0)));
const fix = bind(app(rec, bind(app(binding(1), app(binding(0), binding(0))))));

export const eraseBlocks = (term: Term4): Term3 => {
  switch (term.kind) {
    case TermKind.Block:
      return term.statements.reduceRight((acc, val) => {
        let value = eraseBlocks(val.value);
        if (val.recursive) {
          if (val.name) value = fun([val.name], value);
          else value = bind(value);
          value = app(fix, value);
        }

        if (val.name) acc = fun([val.name], acc);
        else acc = bind(acc);

        if (val.operator) acc = app(val.operator, acc);
        else if (term.operator) acc = app(term.operator, acc);

        return app(acc, value);
      }, eraseBlocks(term.result));
    case TermKind.Binder:
    case TermKind.FunctionWithArgs:
      return { ...term, body: eraseBlocks(term.body) };
    case TermKind.Application:
      return { ...term, arg: eraseBlocks(term.arg), fn: eraseBlocks(term.fn) };
    case TermKind.Value:
    case TermKind.Variable:
    case TermKind.Binding:
      return term;
  }
};

export type ApplicationTerm5 = {
  kind: TermKind.Application;
  fn: Term5;
  arg: Term5;
};
export type BinderTerm5 = {
  kind: TermKind.Binder;
  body: Term5;
};
export type FunctionWithArgsTerm5 = {
  kind: TermKind.FunctionWithArgs;
  names: PatternTerm[];
  body: Term5;
};
export type BlockTerm5 = {
  kind: TermKind.Block;
  operator?: Term5;
  statements: {
    operator?: Term5;
    recursive?: boolean;
    name?: PatternTerm;
    value: Term5;
  }[];
  result: Term5;
};
export type PatternTerm =
  | { kind: TermKind.Pattern; patterns: PatternTerm[] }
  | { kind: TermKind.PatternName; name: string };
export type Term5 =
  | ValueTerm
  | BlockTerm5
  | FunctionWithArgsTerm5
  | VariableTerm
  | BindingTerm
  | ApplicationTerm5
  | BinderTerm5;

const nth = (n: number, total = n + 1) =>
  fun([...Iterator.natural(total).map((x) => "x" + x)], variable("x" + n));
const tuple = (size: number) =>
  fun(
    [...Iterator.natural(size).map((x) => "x" + x)],
    bind(appAll(binding(0), ...Iterator.natural(size).map((x) => "x" + x)))
  );
const block = (statements: any[], result: any) => ({
  kind: TermKind.Block as const,
  statements,
  result,
});

export const erasePatterns = (term: Term5): Term4 => {
  switch (term.kind) {
    case TermKind.Block:
      const statements = term.statements.flatMap((val) => {
        let value = erasePatterns(val.value);
        const name = val.name;
        const operator = val.operator && erasePatterns(val.operator);
        if (!name) return [{ ...val, value, operator }];
        if (name.kind === TermKind.PatternName)
          return [{ ...val, value, name: name.name, operator }];
        if (val.recursive) {
          value = app(fix, erasePatterns(fun([name], value)));
        }
        const destructuring = (pat: PatternTerm) => {
          if (pat.kind === TermKind.PatternName)
            return [{ name: pat.name, value: binding(0) }];

          const patterns = pat.patterns;
          const statements: any[] = [];
          for (const pat of patterns) {
            const i = statements.length;
            const value = app(nth(i, patterns.length), binding(i));

            if (pat.kind === TermKind.PatternName) {
              statements.push({ name: pat.name, value });
              continue;
            }

            statements.push({ value }, ...destructuring(pat));
          }

          return statements;
        };
        return [{ value, operator }, ...destructuring(name)];
      });
      return {
        ...term,
        statements,
        result: erasePatterns(term.result),
        operator: term.operator && erasePatterns(term.operator),
      };
    case TermKind.FunctionWithArgs:
      return term.names.reduce(
        (acc) => bind(acc),
        erasePatterns(
          block(
            term.names.map((term, i) => ({ name: term, value: binding(i) })),
            term.body
          )
        )
      );
    case TermKind.Binder:
      return { ...term, body: erasePatterns(term.body) };
    case TermKind.Application:
      return {
        ...term,
        arg: erasePatterns(term.arg),
        fn: erasePatterns(term.fn),
      };
    case TermKind.Value:
    case TermKind.Variable:
    case TermKind.Binding:
      return term;
  }
};

function getAllNames(pattern: PatternTerm): string[] {
  if (pattern.kind === TermKind.PatternName) return [pattern.name];
  else return pattern.patterns.flatMap((pattern) => getAllNames(pattern));
}

function getUnboundNames(term: Term5): string[] {
  switch (term.kind) {
    case TermKind.Block: {
      const boundNames: string[] = [];
      const unboundNames: string[] = [];

      if (term.operator) {
        unboundNames.push(
          ...getUnboundNames(term.operator).filter((name) =>
            boundNames.includes(name)
          )
        );
      }

      for (const statement of term.statements) {
        if (statement.operator) {
          unboundNames.push(
            ...getUnboundNames(statement.operator).filter((name) =>
              boundNames.includes(name)
            )
          );
        }

        if (statement.recursive && statement.name) {
          boundNames.push(...getAllNames(statement.name));
        }

        unboundNames.push(
          ...getUnboundNames(statement.value).filter((name) =>
            boundNames.includes(name)
          )
        );

        if (statement.recursive && statement.name) {
          boundNames.push(...getAllNames(statement.name));
        }
      }

      unboundNames.push(
        ...getUnboundNames(term.result).filter((name) =>
          boundNames.includes(name)
        )
      );

      return [...new Set(unboundNames)];
    }
    case TermKind.FunctionWithArgs:
      const boundNames = getAllNames({
        kind: TermKind.Pattern,
        patterns: term.names,
      });
      return getUnboundNames(term.body).filter((name) =>
        boundNames.includes(name)
      );
    case TermKind.Binder:
      return getUnboundNames(term.body);
    case TermKind.Application:
      return [...getUnboundNames(term.arg), ...getUnboundNames(term.fn)];
    case TermKind.Variable:
      return [term.name];
    case TermKind.Value:
    case TermKind.Binding:
      return [];
  }
}

const isRecursive = (pattern: PatternTerm, body: Term5) => {
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
    index++;
    if (src[index]?.type === "newline") index++;

    const patterns: PatternTerm[] = [];

    while (src[index].src === ",") {
      index++;
      if (src[index]?.type === "newline") index++;

      const [nextIndex, body, _errors] = parsePattern(src, index);
      index = nextIndex;
      errors.push(..._errors);
      patterns.push(body);
    }

    if (src[index].src === ")") {
      index++;
      if (src[index]?.type === "newline") index++;
      return [index, { kind: TermKind.Pattern, patterns }, errors];
    }
  }

  const token = src[index];
  index++;
  if (src[index]?.type === "newline") index++;
  if (token.type === "identifier")
    return [index, { kind: TermKind.PatternName, name: token.src }, errors];
  return [
    index,
    { kind: TermKind.PatternName, name: "_" },
    [{ message: "can't put values in patterns" }, ...errors],
  ];
};

export const parseTerm = (src: Token[], i = 0): ParsingResult<Term5> => {
  let index = i;
  const errors: ParsingError[] = [];

  if (src[index]?.type === "newline") index++;

  if (src[index].src === "fn") {
    index++;
    if (src[index]?.type === "newline") index++;
    const names: PatternTerm[] = [];

    while (src[index]) {
      console.log(2, src[index], index);
      if (src[index].src === "->") {
        index++;
        if (src[index]?.type === "newline") index++;
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

    if (names.length > 0) return [index, fun(names, body), errors];
    return [index, bind(body), errors];
  }

  if (src[index].src === "(") {
    index++;
    if (src[index]?.type === "newline") index++;

    const [nextIndex, body, _errors] = parseApplication(src, index, [")", ","]);
    index = nextIndex;
    errors.push(..._errors);
    const tupleItems: Term5[] = [];

    if (src[index].src === ",") {
      index++;
      if (src[index]?.type === "newline") index++;
      if (body) tupleItems.push(body);
      let _body: Term5 | null = null;

      while (src[index].src === ",") {
        index++;
        if (src[index]?.type === "newline") index++;
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
      index++;
      if (src[index]?.type === "newline") index++;
      if (tupleItems.length > 0)
        return [index, appAll(tuple(tupleItems.length), ...tupleItems), errors];
      if (!body) return [index, bind(binding(0)), errors];

      return [index, body, errors];
    }
  }

  if (src[index].src === "{") {
    index++;
    if (src[index]?.type === "newline") index++;
    let result: Term5 | null = null;
    const statements: BlockTerm5["statements"] = [];
    while (src[index].src !== "}") {
      let operator: Term5 | null = null;
      if (src[index].src === "with") {
        index++;
        if (src[index]?.type === "newline") index++;
        const [nextIndex, result, _errors] = parseTerm(src, index);

        index = nextIndex;
        errors.push(..._errors);
        operator = result;
      }
      const recursive =
        src[index].src === "recursive"
          ? (index++, src[index]?.type === "newline" ? index++ : null, true)
          : false;

      console.dir([9, src[index], index], { depth: null });
      let pat: PatternTerm | null = null;
      {
        const [nextIndex, _pat, _errors] = parsePattern(src, index);

        if (src[nextIndex].src === "=") {
          index = nextIndex;
          index++;
          if (src[index]?.type === "newline") index++;
          errors.push(..._errors);
          pat = _pat;
        }
      }
      console.dir([9, pat, src[index], index], { depth: null });

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

  const token = src[index];
  index++;
  if (src[index]?.type === "newline") index++;
  if (token.type === "identifier") return [index, variable(token.src), errors];
  if (token.type === "number" || token.type === "string")
    return [index, { kind: TermKind.Value, value: token.value }, errors];
  throw new Error("unreachable"); // ts is stoopid
};

export const parseApplication = (
  src: Token[],
  i = 0,
  banned: string[] = []
): ParsingResult<Term5 | null> => {
  let index = i;
  const errors: ParsingError[] = [];

  let body: Term5 | null = null;
  while (src[index]) {
    console.trace(src[index], index);

    if (banned.includes("\n") && src[index]?.type === "newline") break;
    if (banned.includes(src[index].src)) break;
    const [nextIndex, term, _errors] = parseTerm(src, index);

    index = nextIndex;
    errors.push(..._errors);

    if (
      body?.kind === TermKind.Variable &&
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

export const parse = (src: string, i = 0): ConsumeParsingResult<Term5> => {
  const [tokens, errors] = parseTokens(src, i);
  console.log(tokens);
  const [, term, _errors] = parseApplication(tokens);

  if (!term)
    return [binding(0), [{ message: "cant parse any terms" }, ...errors]];

  return [term, errors];
};
