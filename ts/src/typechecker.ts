// // import { TaggedUnion } from "./types.js";

// // export type Type = TaggedUnion<{
// //   void: {};
// //   unknown: {};
// // }>;

// // Unique symbols representing each variant
// export const FunctionTermSymbol = Symbol("function");
// export const PiFunctionTermSymbol = Symbol("pi function");
// export const ApplicationTermSymbol = Symbol("application");
// export const AnnotationTermSymbol = Symbol("annotation");
// export const VariableTermSymbol = Symbol("variable");
// export const UnitTermSymbol = Symbol("unit type");
// export const UniverseTermSymbol = Symbol("type of types");

// export enum TermType {
//   // Annotation = "annotation",
//   Variable = "variable",
//   Application = "application",
//   Function = "function",
//   PiFunction = "piFunction",
//   Unit = "unit",
//   Universe = "universe",
// }

// export type FunctionTerm = {
//   kind: typeof FunctionTermSymbol;
//   bind?: string;
//   body: (n: Term) => Term;
// };
// export type PiFunctionTerm = {
//   kind: typeof PiFunctionTermSymbol;
//   bind?: string;
//   paramType: Term;
//   returnType: (n: Term) => Term;
// };
// export type ApplicationTerm = {
//   kind: typeof ApplicationTermSymbol;
//   func: Term;
//   arg: Term;
// };
// export type AnnotationTerm = {
//   kind: typeof AnnotationTermSymbol;
//   term: Term;
//   type: Term;
// };
// export type VariableTerm = {
//   kind: typeof VariableTermSymbol;
//   index: number;
// };
// export type UnitTerm = { kind: typeof UnitTermSymbol };
// export type UniverseTerm = { kind: typeof UniverseTermSymbol };

// export type Value =
//   | FunctionTerm
//   | PiFunctionTerm
//   | VariableTerm
//   | ApplicationTerm
//   | UnitTerm
//   | UniverseTerm;
// export type Term = Value | AnnotationTerm;

// export function print(lvl: number, term: Term): string {
//   switch (term.kind) {
//     case FunctionTermSymbol:
//       return `(lambda ${print(
//         lvl + 1,
//         term.body({ kind: VariableTermSymbol, index: lvl })
//       )})`;
//     case PiFunctionTermSymbol:
//       return `(pi ${print(lvl, term.paramType)}.${print(
//         lvl + 1,
//         term.returnType({ kind: VariableTermSymbol, index: lvl })
//       )})`;
//     case ApplicationTermSymbol:
//       return `(${print(lvl, term.func)} ${print(lvl, term.arg)})`;
//     case AnnotationTermSymbol:
//       return `(${print(lvl, term.term)} : ${print(lvl, term.type)})`;
//     case VariableTermSymbol:
//       return term.index.toString();
//     case UnitTermSymbol:
//       return "*";
//     case UniverseTermSymbol:
//       return "<>";
//     default:
//       throw new Error("Unknown term type");
//   }
// }

// export function evaluate(term: Term): Value {
//   switch (term.kind) {
//     case FunctionTermSymbol:
//       return {
//         kind: FunctionTermSymbol,
//         body: (n: Term) => evaluate(term.body(n)),
//       };
//     case PiFunctionTermSymbol:
//       return {
//         kind: PiFunctionTermSymbol,
//         paramType: evaluate(term.paramType),
//         returnType: (n: Term) => evaluate(term.returnType(n)),
//       };
//     case ApplicationTermSymbol:
//       const func = evaluate(term.func);
//       const arg = evaluate(term.arg);
//       if (func.kind !== FunctionTermSymbol)
//         return { kind: ApplicationTermSymbol, func, arg };
//       return evaluate(func.body(arg));
//     case AnnotationTermSymbol:
//       return evaluate(term.term);
//     case VariableTermSymbol:
//     case UnitTermSymbol:
//     case UniverseTermSymbol:
//       return term;
//     default:
//       throw new Error("Unknown term type");
//   }
// }

// export function equate(lvl: number, t1: Term, t2: Term): boolean {
//   if (t1.kind !== t2.kind) return false;

//   const plunge = (f: (n: Term) => Term, g: (n: Term) => Term) =>
//     equate(
//       lvl + 1,
//       f({ kind: VariableTermSymbol, index: lvl }),
//       g({ kind: VariableTermSymbol, index: lvl })
//     );

//   switch (t1.kind) {
//     case FunctionTermSymbol:
//       if (t2.kind !== FunctionTermSymbol) return false; // redundant
//       return plunge(t1.body, t2.body);
//     case PiFunctionTermSymbol:
//       if (t2.kind !== PiFunctionTermSymbol) return false; // redundant
//       return (
//         equate(lvl, t1.paramType, t2.paramType) &&
//         plunge(t1.returnType, t2.returnType)
//       );
//     case ApplicationTermSymbol:
//       if (t2.kind !== ApplicationTermSymbol) return false; // redundant
//       return equate(lvl, t1.func, t2.func) && equate(lvl, t1.arg, t2.arg);
//     case AnnotationTermSymbol:
//       if (t2.kind !== AnnotationTermSymbol) return false; // redundant
//       return equate(lvl, t1.term, t2.term) && equate(lvl, t1.type, t2.type);
//     case VariableTermSymbol:
//       return t2.kind === VariableTermSymbol && t1.index === t2.index; // redundant
//     case UnitTermSymbol:
//     case UniverseTermSymbol:
//       return t1.kind === t2.kind;
//     default:
//       return false;
//   }
// }

// export function panic(lvl: number, t: Term, message: string): never {
//   const termStr = print(lvl, t);
//   throw new Error(`${message}: ${termStr}`);
// }

// export function inferType(lvl: number, ctx: Term[], term: Term): Term {
//   switch (term.kind) {
//     case PiFunctionTermSymbol:
//       inferSort(lvl, ctx, term.paramType);
//       return inferSort(
//         lvl + 1,
//         [evaluate(term.paramType), ...ctx],
//         term.returnType({ kind: VariableTermSymbol, index: lvl })
//       );
//     case ApplicationTermSymbol:
//       const funcTerm = inferType(lvl, ctx, term.func);
//       if (funcTerm.kind !== PiFunctionTermSymbol)
//         panic(lvl, term.func, "Want a Pi type, got");
//       checkType(lvl, ctx, term.arg, funcTerm.paramType);
//       return funcTerm.returnType(term.arg);
//     case AnnotationTermSymbol:
//       inferSort(lvl, ctx, term.type);
//       return checkType(lvl, ctx, term.term, evaluate(term.type));
//     case VariableTermSymbol:
//       return ctx[lvl - 1 - term.index];
//     case UnitTermSymbol:
//       return { kind: UniverseTermSymbol };
//     case UniverseTermSymbol:
//       panic(lvl, { kind: UniverseTermSymbol }, "Has no type");
//     default:
//       throw new Error("Not inferrable");
//   }
// }

// export function inferSort(lvl: number, ctx: Term[], a: Term): Value {
//   const ty = inferType(lvl, ctx, a);
//   if (ty.kind === UnitTermSymbol || ty.kind === UniverseTermSymbol) {
//     return ty;
//   }
//   panic(lvl, a, "Want a sort, got");
// }

// export function checkType(lvl: number, ctx: Term[], term: Term, expectedType: Term): Term {
//   switch (term.kind) {
//     case TermKind.Function:
//       if (expectedType.kind !== TermKind.PiFunction)
//         panic(lvl, term, `Want a Pi type, got ${print(lvl, expectedType)}`);

//       checkType(
//         lvl + 1,
//         [expectedType.paramType, ...ctx],
//         term.body({ kind: TermKind.Variable, index: lvl }),
//         expectedType.returnType({ kind: TermKind.Variable, index: lvl })
//       );
//       return {
//         kind: TermKind.PiFunction,
//         paramType: expectedType.paramType,
//         returnType: expectedType.returnType,
//       };

//     default:
//       const gotTy = inferType(lvl, ctx, term);
//       if (equate(lvl, expectedType, gotTy)) return expectedType;
//       panic(lvl, term, `Want type ${print(lvl, expectedType)}, got ${print(lvl, gotTy)}`);
//   }
// }

export enum TermKind {
  Variable = "variable",
  Application = "application",
  Function = "function",
  PiFunction = "piFunction",
  Type = "type",
  Kind = "kind",
}

export type VariableTerm = { kind: TermKind.Variable; name: string };
export type ApplicationTerm = {
  kind: TermKind.Application;
  fn: Term;
  arg: Term;
};
export type FunctionTerm = {
  kind: TermKind.Function | TermKind.PiFunction;
  variable: string;
  variableType: Term;
  body: Term;
};
export type StarTerm = { kind: TermKind.Type };
export type BoxTerm = { kind: TermKind.Kind };

export type StrictResolvedVariableTerm = {
  kind: TermKind.Variable;
  index: number;
  name?: string;
};
export type StrictResolvedApplicationTerm = {
  kind: TermKind.Application;
  fn: StrictResolvedTerm;
  arg: StrictResolvedTerm;
};
export type StrictResolvedFunctionTerm = {
  kind: TermKind.Function | TermKind.PiFunction;
  variable?: string;
  variableType: StrictResolvedTerm;
  body: StrictResolvedTerm;
};

export type ResolvedVariableTerm = VariableTerm | StrictResolvedVariableTerm;
export type ResolvedApplicationTerm = {
  kind: TermKind.Application;
  fn: ResolvedTerm;
  arg: ResolvedTerm;
};
export type ResolvedFunctionTerm = {
  kind: TermKind.Function | TermKind.PiFunction;
  variable?: string;
  variableType: ResolvedTerm;
  body: ResolvedTerm;
};

// HOAS - Higher-order Abstract syntax
export type HOASApplicationTerm = {
  kind: TermKind.Application;
  fn: HOASTerm;
  arg: HOASTerm;
};
export type HOASFunctionTerm = {
  kind: TermKind.Function | TermKind.PiFunction;
  variable?: string;
  variableType: HOASTerm;
  body: (arg: HOASTerm) => HOASTerm;
};

export type LTerm = VariableTerm | ApplicationTerm | FunctionTerm;

export type LATerm = VariableTerm | ApplicationTerm | FunctionTerm;

export type Term =
  | VariableTerm
  | ApplicationTerm
  | FunctionTerm
  | StarTerm
  | BoxTerm;

// term enriched with debruijn indices (how far away from usage are variables in stack)
export type ResolvedTerm =
  | ResolvedVariableTerm
  | ResolvedApplicationTerm
  | ResolvedFunctionTerm
  | StarTerm
  | BoxTerm;

// IR that does not allow unresolved variables
export type StrictResolvedTerm =
  | StrictResolvedVariableTerm
  | StrictResolvedApplicationTerm
  | StrictResolvedFunctionTerm
  | StarTerm
  | BoxTerm;

// nicer to write by hand
export type HOASTerm =
  | ResolvedVariableTerm
  | HOASApplicationTerm
  | HOASFunctionTerm
  | StarTerm
  | BoxTerm;

export type Context = ResolvedTerm[];

export const resolve = (
  term: ResolvedTerm,
  ctx: string[] = []
): ResolvedTerm => {
  switch (term.kind) {
    case TermKind.Variable:
      if ("index" in term) return term;
      const index = ctx.indexOf(term.name);
      if (index === -1) {
        return { kind: TermKind.Variable, name: term.name };
      } else {
        return { kind: TermKind.Variable, name: term.name, index };
      }
    case TermKind.Application:
      return {
        kind: TermKind.Application,
        fn: resolve(term.fn, ctx),
        arg: resolve(term.arg, ctx),
      };
    case TermKind.PiFunction:
    case TermKind.Function:
      return {
        ...term,
        variableType: resolve(term.variableType, ctx),
        body: resolve(term.body, [term.variable ?? "", ...ctx]),
      };
    case TermKind.Type:
      return { kind: TermKind.Type };
    case TermKind.Kind:
      return { kind: TermKind.Kind };
  }
};
const HOASToTerm = (term: HOASTerm, ctx: string[] = []): ResolvedTerm => {
  switch (term.kind) {
    case TermKind.Function:
    case TermKind.PiFunction:
      const variable =
        term.variable ?? generateNewName(ctx, `arg${ctx.length + 1}`);
      return {
        ...term,
        variable,
        variableType: HOASToTerm(term.variableType, ctx),
        body: HOASToTerm(
          term.body({ kind: TermKind.Variable, name: variable }),
          [variable, ...ctx]
        ),
      };
    case TermKind.Application:
      return {
        ...term,
        fn: HOASToTerm(term.fn, ctx),
        arg: HOASToTerm(term.arg, ctx),
      };
    case TermKind.Variable:
    case TermKind.Type:
    case TermKind.Kind:
      return term;
  }
};

export const HOASToResolved = (term: HOASTerm): ResolvedTerm =>
  resolve(HOASToTerm(term));

export const print = (term: ResolvedTerm): string => {
  switch (term.kind) {
    case TermKind.Variable:
      if ("index" in term) return term.name ?? `arg${term.index}`;
      return term.name;
    case TermKind.Application:
      return `(${print(term.fn)} ${print(term.arg)})`;
    case TermKind.Function:
    case TermKind.PiFunction:
      const name = term.variable ? term.variable + ":" : "";
      const type = print(term.variableType);
      const body = print(term.body);
      return `(${term.kind} ${name}${type}.${body})`;
    case TermKind.Type:
      return "*";
    case TermKind.Kind:
      return "<>";
  }
};

export const isEqualTerms = (
  term1: ResolvedTerm,
  term2: ResolvedTerm
): boolean => {
  switch (term1.kind) {
    case TermKind.Variable:
      if (term2.kind !== TermKind.Variable) return false;
      if ("index" in term1 && "index" in term2)
        return term1.index === term2.index;
      return term1.name === term2.name;
    case TermKind.Application:
      return (
        term2.kind === TermKind.Application &&
        isEqualTerms(term1.fn, term2.fn) &&
        isEqualTerms(term1.arg, term2.arg)
      );
    case TermKind.Function:
    case TermKind.PiFunction:
      if (term2.kind !== term1.kind) return false;
      return (
        isEqualTerms(term1.variableType, term2.variableType) &&
        isEqualTerms(term1.body, term2.body)
      );
    case TermKind.Type:
    case TermKind.Kind:
      return term1.kind === term2.kind;
  }
};

const freeVariables = (term: ResolvedTerm): string[] => {
  switch (term.kind) {
    case TermKind.Variable:
      return "index" in term ? [] : [term.name];
    case TermKind.Application:
      return [...freeVariables(term.fn), ...freeVariables(term.arg)];
    case TermKind.Function:
    case TermKind.PiFunction:
      return [
        ...freeVariables(term.variableType),
        ...freeVariables(term.body).filter(
          (variable) => variable !== term.variable
        ),
      ];
    case TermKind.Type:
    case TermKind.Kind:
      return [];
  }
};

const boundVariables = (term: Term): string[] => {
  switch (term.kind) {
    case TermKind.Application:
      return [...boundVariables(term.fn), ...boundVariables(term.arg)];
    case TermKind.Function:
    case TermKind.PiFunction:
      return [
        term.variable,
        ...boundVariables(term.variableType),
        ...boundVariables(term.body),
      ];
    case TermKind.Variable:
    case TermKind.Type:
    case TermKind.Kind:
      return [];
  }
};

const allVariables = (term: Term): string[] => [
  ...freeVariables(term),
  ...boundVariables(term),
];

const generateNewName = (banList: string[], base: string): string => {
  if (banList.includes(base)) return generateNewName(banList, base + "'");
  return base;
};

export const evaluate = (term: ResolvedTerm): ResolvedTerm => {
  switch (term.kind) {
    case TermKind.Application:
      const fn = evaluate(term.fn);
      const arg = evaluate(term.arg);
      if (fn.kind === TermKind.Function) {
        return substituteVar(0, arg, fn.body);
      } else {
        return { kind: TermKind.Application, fn, arg };
      }
    case TermKind.Function:
    case TermKind.PiFunction:
      return {
        ...term,
        variableType: evaluate(term.variableType),
        body: evaluate(term.body),
      };
    case TermKind.Variable:
    case TermKind.Type:
    case TermKind.Kind:
      return term;
  }
};

const substituteName = (
  variableName: string,
  substitution: Term,
  term: Term
): Term => {
  switch (term.kind) {
    case TermKind.Variable:
      return term.name === variableName ? substitution : term;
    case TermKind.Application:
      return {
        kind: TermKind.Application,
        fn: substituteName(variableName, substitution, term.fn),
        arg: substituteName(variableName, substitution, term.arg),
      };
    case TermKind.Function:
    case TermKind.PiFunction:
      if (term.variable === variableName) {
        return {
          ...term,
          variableType: substituteName(
            variableName,
            substitution,
            term.variableType!
          ),
        };
      } else if (freeVariables(substitution).includes(term.variable)) {
        const banList = [
          ...freeVariables(substitution),
          ...allVariables(term.body),
        ];
        const newName = generateNewName(banList, term.variable);
        const termWithNewName = {
          ...term,
          variable: newName,
          body: substituteName(
            term.variable,
            { kind: TermKind.Variable, name: newName },
            term.body
          ),
        };
        return substituteName(variableName, substitution, termWithNewName);
      } else {
        return {
          ...term,
          variableType: substituteName(
            variableName,
            substitution,
            term.variableType!
          ),
          body: substituteName(variableName, substitution, term.body),
        };
      }
    case TermKind.Type:
    case TermKind.Kind:
      return term;
  }
};

const substituteVar = (
  variableIndex: number,
  substitution: ResolvedTerm,
  term: ResolvedTerm
): ResolvedTerm => {
  switch (term.kind) {
    case TermKind.Variable:
      if (!("index" in term) || term.index !== variableIndex) return term;
      else return substitution;
    case TermKind.Application:
      return {
        kind: TermKind.Application,
        fn: substituteVar(variableIndex, substitution, term.fn),
        arg: substituteVar(variableIndex, substitution, term.arg),
      };
    case TermKind.Function:
    case TermKind.PiFunction:
      return {
        ...term,
        variableType: substituteVar(
          variableIndex,
          substitution,
          term.variableType
        ),
        body: substituteVar(variableIndex + 1, substitution, term.body),
      };
    case TermKind.Type:
    case TermKind.Kind:
      return term;
  }
};

export const inferType = (
  term: ResolvedTerm,
  ctx: Context = []
): ResolvedTerm => {
  switch (term.kind) {
    case TermKind.Variable:
      if ("index" in term) return evaluate(ctx[term.index]);
      throw new Error(`Variable '${term.name}' not found in the context.`);
    case TermKind.Application:
      const fnType = inferType(term.fn, ctx);
      if (fnType.kind !== TermKind.PiFunction) {
        throw new Error(
          `Application of argument ${print(term.arg)} to a non-lambda ${print(
            term.fn
          )} of type ${print(fnType)}`
        );
      }

      checkType(term.arg, fnType.variableType, ctx);

      return evaluate(substituteVar(ctx.length, term.arg, fnType.body));
    case TermKind.Function: {
      const bodyType = inferType(term.body, [term.variableType, ...ctx]);
      const fnType: ResolvedTerm = {
        kind: TermKind.PiFunction,
        variable: term.variable,
        variableType: term.variableType,
        body: bodyType,
      };
      inferType(fnType, ctx);
      return evaluate(fnType);
    }
    case TermKind.PiFunction:
      inferSort(term.variableType, ctx);
      return inferSort(term.body, [term.variableType, ...ctx]);
    case TermKind.Type:
    case TermKind.Kind:
      // return { kind: TermKind.Kind };
      throw new Error(`'Box' has no type.`);
  }
};

export const inferSort = (
  term: ResolvedTerm,
  ctx: Context = []
): ResolvedTerm => {
  const inferred = inferType(term, ctx);
  if (inferred.kind === TermKind.Type || inferred.kind === TermKind.Kind) {
    return inferred;
  }
  throw new Error(`Expected a sort, got ${print(term)}: ${print(inferred)}`);
};

export const checkType = (
  term: ResolvedTerm,
  expectedType: ResolvedTerm,
  ctx: Context = []
): void => {
  const inferredType = inferType(term, ctx);
  if (!isEqualTerms(inferredType, expectedType)) {
    throw new Error(
      `Expected type '${print(expectedType)}', but got '${print(
        inferredType
      )}'.`
    );
  }
};
