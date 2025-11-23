export enum InstructionCode {
  Add = "Add",
  Sub = "Sub",
  Mul = "Mul",
  Div = "Div",
  Mod = "Mod",
  Pow = "Pow",

  And = "And",
  Or = "Or",
  Not = "Not",
  Eq = "Eq",
  Gt = "Gt",

  Const = "Const",
  Alloc = "Alloc",
  Free = "Free",

  Call = "Call",
  Return = "Return",

  // SetHandle,
  // EmitEffect,

  Jump = "Jump",
  Native = "Native",
  Closure = "Closure",
  CallValue = "CallValue",
  Load = "Load",
  Store = "Store",
  Tuple = "Tuple",
  Record = "Record",
  In = "In",
  Lt = "Lt",
  DeepEq = "DeepEq",
  Concat = "Concat",
}

export type ClosureEnv = {
  values: Record<string, Value>;
  parent?: ClosureEnv;
};
export type Closure = {
  functionName: string;
  env: ClosureEnv;
};
export type SymbolValue = { symbol: string | number; name?: string };
export type Value =
  | number
  | string
  | boolean
  | null
  | undefined
  | Closure
  | { ref: string }
  | SymbolValue
  | { tuple: Value[] }
  | { record: Record<string, Value> };

export type Instruction =
  | { code: InstructionCode.Add }
  | { code: InstructionCode.Sub }
  | { code: InstructionCode.Mul }
  | { code: InstructionCode.Div }
  | { code: InstructionCode.Mod }
  | { code: InstructionCode.Pow }
  | { code: InstructionCode.And }
  | { code: InstructionCode.Or }
  | { code: InstructionCode.Not }
  | { code: InstructionCode.Eq }
  | { code: InstructionCode.Gt }
  | { code: InstructionCode.Lt }
  | { code: InstructionCode.Const; arg1: Value }
  | { code: InstructionCode.Alloc }
  | { code: InstructionCode.Free }
  | { code: InstructionCode.Load }
  | { code: InstructionCode.Store }
  | { code: InstructionCode.Tuple; arg1: number }
  | { code: InstructionCode.Record; arg1: number }
  | { code: InstructionCode.In }
  | { code: InstructionCode.DeepEq }
  | { code: InstructionCode.Call; arg1: string; arg2?: number }
  | { code: InstructionCode.CallValue; arg1: number }
  | { code: InstructionCode.Return }
  | { code: InstructionCode.Jump; arg1: number }
  | { code: InstructionCode.Native; arg1: string; arg2?: number }
  | { code: InstructionCode.Closure; arg1: string }
  | { code: InstructionCode.Concat };

export type FunctionCode = Instruction[];
export type Program = Record<string, FunctionCode>;
