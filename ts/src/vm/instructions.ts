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
  In = "In",
  Lt = "Lt",
  DeepEq = "DeepEq",

  Const = "Const",
  Alloc = "Alloc",
  Free = "Free",

  Call = "Call",
  Return = "Return",

  // Pop = "Pop",
  // Duplicate = "Duplicate",
  // Swap = "Swap",

  // SetHandle="SetHandle",
  // EmitEffect="EmitEffect",

  Fork = "Fork",
  Join = "Join",
  // ForkDetached="ForkDetached",

  Send = "Send",
  Receive = "Receive",
  TrySend = "TrySend",
  TryReceive = "TryReceive",

  Load = "Load",
  Store = "Store",
  // LoadAcquire = "LoadAcquire",
  // StoreRelease = "StoreRelease",
  // CompareAndSwap = "CompareAndSwap",
  // Fence = "Fence",

  Jump = "Jump",
  JumpIfFalse = "JumpIfFalse",
  Native = "Native",
  Closure = "Closure",
  Tuple = "Tuple",
  Record = "Record",

  Concat = "Concat",
  Length = "Length",
  Index = "Index",
  Append = "Append",
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
  | { thread: string }
  | { channel: string; name?: string }
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
  | { code: InstructionCode.Length }
  | { code: InstructionCode.Index }
  | { code: InstructionCode.Append }
  | { code: InstructionCode.Call; arg1?: string; arg2?: number }
  | { code: InstructionCode.Return }
  | { code: InstructionCode.Jump; arg1: number }
  | { code: InstructionCode.JumpIfFalse; arg1: number }
  | { code: InstructionCode.Native; arg1: string; arg2?: number }
  | { code: InstructionCode.Closure; arg1: string }
  | { code: InstructionCode.Fork }
  | { code: InstructionCode.Join }
  | { code: InstructionCode.Send }
  | { code: InstructionCode.Receive }
  | { code: InstructionCode.TrySend }
  | { code: InstructionCode.TryReceive }
  | { code: InstructionCode.Concat };

export type FunctionCode = Instruction[];
export type Program = Record<string, FunctionCode>;
