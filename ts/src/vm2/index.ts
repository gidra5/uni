enum InstructionCode {
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

  Jump,
  Native,
}

type FunctionInstruction = {
  code: InstructionCode;
  arg1?: string;
  arg2?: string;
};

type FunctionCode = FunctionInstruction[];

type Closure = {
  functionName: string;
  closure: Record<string, Value>;
};
type Value = number | string | boolean | null | undefined;

type CallStackEntry = {
  ip: number;
  name: string;
};

type HandlerStackEntry = {};

type StackEntry = {};

type HeapEntry = {};

class Thread {
  stack: StackEntry[] = [];
  callStack: CallStackEntry[] = [];
  handlerStack: HandlerStackEntry[] = [];

  ip: number = 0;
  name: string = "main";

  step(vm: VM) {
    const functionInstrunction = vm.code[this.name][this.ip];

    switch (functionInstrunction.code) {
      default:
        throw new Error("unknown instruction");
    }
  }
}

class VM {
  threads: Record<string, Thread> = {};
  heap: Record<string, HeapEntry> = {};

  code: Record<string, FunctionCode> = {};
  natives: Record<string, Function> = {};

  run() {
    for (const thread of Object.values(this.threads)) {
      thread.step(this);
    }
  }
}
