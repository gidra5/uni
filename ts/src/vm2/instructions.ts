export enum InstructionCode {
  Add,
  Sub,
  Mul,
  Div,
  Mod,
  Pow,

  And,
  Or,
  Not,
  Eq,
  Gt,

  Const,
  Alloc,
  Free,

  Call,
  Return,

  // SetHandle,
  // EmitEffect,

  Jump,
  Native,
}

export type Closure = {
  functionName: string;
  env: Record<string, Value>;
};
export type Value = number | string | boolean | null | undefined | Closure | { ref: string };

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
  | { code: InstructionCode.Const; arg1: Value }
  | { code: InstructionCode.Alloc; arg1: string }
  | { code: InstructionCode.Free; arg1: string }
  | { code: InstructionCode.Call; arg1: string; arg2?: number }
  | { code: InstructionCode.Return }
  | { code: InstructionCode.Jump; arg1: number }
  | { code: InstructionCode.Native; arg1: string; arg2?: number };

export type FunctionCode = Instruction[];
export type Program = Record<string, FunctionCode>;
