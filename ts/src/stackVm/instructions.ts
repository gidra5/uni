export enum InstructionCode {
  PUSH,
  POP,
  GET,
  SET,
  SWAP,
  INSERT,
  REMOVE,
  PUSH_FRAME,
  POP_FRAME,

  JUMP_RELATIVE,
  JUMP_ABSOLUTE,

  ENTRY_POINT,
  CALL,
  RETURN,

  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  POW,
  SHL,
  SHR,

  AND,
  OR,
  XOR,
  NOT,
  EQ,
  LT,
  GT,
}
const INSTRUCTIONS_SIZE = Object.keys(InstructionCode).filter(Number.isNaN).length;

export type StackValue = number;
type WideInstruction = { code: InstructionCode.PUSH; value: number | boolean };
export type Instruction = WideInstruction | { code: Exclude<InstructionCode, WideInstruction["code"]> };

export function push(value: number | boolean): Instruction {
  return { code: InstructionCode.PUSH, value };
}

export function pop(): Instruction {
  return { code: InstructionCode.POP };
}

export function get(): Instruction {
  return { code: InstructionCode.GET };
}

export function set(): Instruction {
  return { code: InstructionCode.SET };
}

export function swap(): Instruction {
  return { code: InstructionCode.SWAP };
}

export function insert(): Instruction {
  return { code: InstructionCode.INSERT };
}

export function remove(): Instruction {
  return { code: InstructionCode.REMOVE };
}

export function pushFrame(): Instruction {
  return { code: InstructionCode.PUSH_FRAME };
}

export function popFrame(): Instruction {
  return { code: InstructionCode.POP_FRAME };
}

export function jumpAbs(): Instruction {
  return { code: InstructionCode.JUMP_ABSOLUTE };
}

export function jumpRel(): Instruction {
  return { code: InstructionCode.JUMP_RELATIVE };
}

export function entryPoint(): Instruction {
  return { code: InstructionCode.ENTRY_POINT };
}

export function call(): Instruction {
  return { code: InstructionCode.CALL };
}

export function _return(): Instruction {
  return { code: InstructionCode.RETURN };
}

export function add(): Instruction {
  return { code: InstructionCode.ADD };
}

export function sub(): Instruction {
  return { code: InstructionCode.SUB };
}

export function mul(): Instruction {
  return { code: InstructionCode.MUL };
}

export function div(): Instruction {
  return { code: InstructionCode.DIV };
}

export function mod(): Instruction {
  return { code: InstructionCode.MOD };
}

export function pow(): Instruction {
  return { code: InstructionCode.POW };
}

export function shl(): Instruction {
  return { code: InstructionCode.SHL };
}

export function shr(): Instruction {
  return { code: InstructionCode.SHR };
}

export function and(): Instruction {
  return { code: InstructionCode.AND };
}

export function or(): Instruction {
  return { code: InstructionCode.OR };
}

export function xor(): Instruction {
  return { code: InstructionCode.XOR };
}

export function not(): Instruction {
  return { code: InstructionCode.NOT };
}

export function eq(): Instruction {
  return { code: InstructionCode.EQ };
}

export function lt(): Instruction {
  return { code: InstructionCode.LT };
}

export function gt(): Instruction {
  return { code: InstructionCode.GT };
}

function encodeInstruction(instruction: Instruction): number[] {
  if (instruction.code === InstructionCode.PUSH) {
    return [instruction.code, Number(instruction.value)];
  }
  return [instruction.code];
}

function decodeInstruction(code: number, i: number, image: Uint8Array): [instr: Instruction, next: number] {
  if (code > INSTRUCTIONS_SIZE) {
    throw new Error("Invalid instruction code");
  }

  if (code === InstructionCode.PUSH) {
    const value = image[++i];
    return [{ code, value }, i + 1];
  }

  return [{ code }, i + 1];
}

export function decode(image: Uint8Array): Instruction[] {
  let index = 0;
  const instructions: Instruction[] = [];
  while (index < image.length) {
    const [instr, next] = decodeInstruction(image[index], index, image);
    instructions.push(instr);
    index = next;
  }
  return instructions;
}

export function encode(code: Instruction[]): Uint8Array {
  return new Uint8Array(code.flatMap(encodeInstruction));
}

if (import.meta.vitest) {
  const { expect } = import.meta.vitest;
  const { it, fc } = await import("@fast-check/vitest");
  const { Iterator } = await import("iterator-js");

  const instructionArb = fc.oneof(
    fc.nat().map<Instruction>((value) => ({ code: InstructionCode.PUSH, value })),
    ...Iterator.range(1, INSTRUCTIONS_SIZE).map((x) => fc.constant(x).map<Instruction>((code) => ({ code })))
  );

  it.prop([fc.uint8Array()])("decode-encode", (image) => {
    expect(encode(decode(image))).toEqual(image);
  });

  it.prop([fc.array(instructionArb)])("encode-decode", (instructions) => {
    expect(decode(encode(instructions))).toEqual(instructions);
  });
}
