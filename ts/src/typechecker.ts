// import { TaggedUnion } from "./types.js";

// export type Type = TaggedUnion<{
//   void: {};
//   unknown: {};
// }>;

// Unique symbols representing each variant
export const FunctionTermSymbol = Symbol("function");
export const PiFunctionTermSymbol = Symbol("pi function");
export const ApplicationTermSymbol = Symbol("application");
export const AnnotationTermSymbol = Symbol("annotation");
export const VariableTermSymbol = Symbol("variable");
export const UnitTermSymbol = Symbol("unit type");
export const UniverseTermSymbol = Symbol("type of types");

export type FunctionTerm = {
  kind: typeof FunctionTermSymbol;
  body: (n: Term) => Term;
};
export type PiFunctionTerm = {
  kind: typeof PiFunctionTermSymbol;
  paramType: Term;
  returnType: (n: Term) => Term;
};
export type ApplicationTerm = {
  kind: typeof ApplicationTermSymbol;
  func: Term;
  arg: Term;
};
export type AnnotationTerm = {
  kind: typeof AnnotationTermSymbol;
  term: Term;
  type: Term;
};
export type VariableTerm = { kind: typeof VariableTermSymbol; index: number };
export type UnitTerm = { kind: typeof UnitTermSymbol };
export type UniverseTerm = { kind: typeof UniverseTermSymbol };

export type Value =
  | FunctionTerm
  | PiFunctionTerm
  | VariableTerm
  | UnitTerm
  | UniverseTerm;
export type Term = Value | ApplicationTerm | AnnotationTerm;

export function print(lvl: number, term: Term): string {
  switch (term.kind) {
    case FunctionTermSymbol:
      return `(lambda ${print(
        lvl + 1,
        term.body({ kind: VariableTermSymbol, index: lvl })
      )})`;
    case PiFunctionTermSymbol:
      return `(pi ${print(lvl, term.paramType)}.${print(
        lvl + 1,
        term.returnType({ kind: VariableTermSymbol, index: lvl })
      )})`;
    case ApplicationTermSymbol:
      return `(${print(lvl, term.func)} ${print(lvl, term.arg)})`;
    case AnnotationTermSymbol:
      return `(${print(lvl, term.term)} : ${print(lvl, term.type)})`;
    case VariableTermSymbol:
      return term.index.toString();
    case UnitTermSymbol:
      return "*";
    case UniverseTermSymbol:
      return "<>";
    default:
      throw new Error("Unknown term type");
  }
}

export function evaluate(term: Term): Term {
  switch (term.kind) {
    case FunctionTermSymbol:
      return {
        kind: FunctionTermSymbol,
        body: (n: Term) => evaluate(term.body(n)),
      };
    case PiFunctionTermSymbol:
      return {
        kind: PiFunctionTermSymbol,
        paramType: evaluate(term.paramType),
        returnType: (n: Term) => evaluate(term.returnType(n)),
      };
    case ApplicationTermSymbol:
      const func = evaluate(term.func);
      const arg = evaluate(term.arg);
      return func.kind === FunctionTermSymbol
        ? func.body(arg)
        : { kind: ApplicationTermSymbol, func, arg };
    case AnnotationTermSymbol:
      return evaluate(term.term);
    case VariableTermSymbol:
    case UnitTermSymbol:
    case UniverseTermSymbol:
      return term;
    default:
      throw new Error("Unknown term type");
  }
}

export function equate(lvl: number, t1: Term, t2: Term): boolean {
  if (t1.kind !== t2.kind) return false;

  const plunge = (f: (n: Term) => Term, g: (n: Term) => Term) =>
    equate(
      lvl + 1,
      f({ kind: VariableTermSymbol, index: lvl }),
      g({ kind: VariableTermSymbol, index: lvl })
    );

  switch (t1.kind) {
    case FunctionTermSymbol:
      if (t2.kind !== FunctionTermSymbol) return false; // redundant
      return plunge(t1.body, t2.body);
    case PiFunctionTermSymbol:
      if (t2.kind !== PiFunctionTermSymbol) return false; // redundant
      return (
        equate(lvl, t1.paramType, t2.paramType) &&
        plunge(t1.returnType, t2.returnType)
      );
    case ApplicationTermSymbol:
      if (t2.kind !== ApplicationTermSymbol) return false; // redundant
      return equate(lvl, t1.func, t2.func) && equate(lvl, t1.arg, t2.arg);
    case AnnotationTermSymbol:
      if (t2.kind !== AnnotationTermSymbol) return false; // redundant
      return equate(lvl, t1.term, t2.term) && equate(lvl, t1.type, t2.type);
    case VariableTermSymbol:
      return t2.kind === VariableTermSymbol && t1.index === t2.index; // redundant
    case UnitTermSymbol:
    case UniverseTermSymbol:
      return t1.kind === t2.kind;
    default:
      return false;
  }
}

export function panic(lvl: number, t: Term, message: string): never {
  const termStr = print(lvl, t);
  throw new Error(`${message}: ${termStr}`);
}

export function inferType(lvl: number, ctx: Term[], term: Term): Term {
  switch (term.kind) {
    case PiFunctionTermSymbol:
      inferSort(lvl, ctx, term.paramType);
      return inferSort(
        lvl + 1,
        [evaluate(term.paramType), ...ctx],
        term.returnType({ kind: VariableTermSymbol, index: lvl })
      );
    case ApplicationTermSymbol:
      const funcTerm = inferType(lvl, ctx, term.func);
      if (funcTerm.kind !== PiFunctionTermSymbol)
        panic(lvl, term.func, "Want a Pi type, got");
      checkType(lvl, ctx, term.arg, funcTerm.paramType);
      return funcTerm.returnType(term.arg);
    case AnnotationTermSymbol:
      inferSort(lvl, ctx, term.type);
      return checkType(lvl, ctx, term.term, evaluate(term.type));
    case VariableTermSymbol:
      return ctx[lvl - 1 - term.index];
    case UnitTermSymbol:
      return { kind: UniverseTermSymbol };
    case UniverseTermSymbol:
      panic(lvl, { kind: UniverseTermSymbol }, "Has no type");
    default:
      throw new Error("Not inferrable");
  }
}

export function inferSort(lvl: number, ctx: Term[], a: Term): Term {
  const ty = inferType(lvl, ctx, a);
  if (ty.kind === UnitTermSymbol || ty.kind === UniverseTermSymbol) {
    return ty;
  }
  panic(lvl, a, "Want a sort, got");
}

export function checkType(lvl: number, ctx: Term[], t: Term, ty: Term): Term {
  switch (t.kind) {
    case FunctionTermSymbol:
      if (ty.kind !== PiFunctionTermSymbol)
        panic(lvl, t, `Want a Pi type, got ${print(lvl, ty)}`);

      checkType(
        lvl + 1,
        [ty.paramType, ...ctx],
        t.body({ kind: VariableTermSymbol, index: lvl }),
        ty.returnType({ kind: VariableTermSymbol, index: lvl })
      );
      return {
        kind: PiFunctionTermSymbol,
        paramType: ty.paramType,
        returnType: ty.returnType,
      };

    default:
      const gotTy = inferType(lvl, ctx, t);
      if (equate(lvl, ty, gotTy)) return ty;
      panic(lvl, t, `Want type ${print(lvl, ty)}, got ${print(lvl, gotTy)}`);
  }
}

// Append checkType function to the previous code
