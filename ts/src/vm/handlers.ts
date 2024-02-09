import { Register } from "./memory.js";
import { putBuf, signExtend } from "./utils.js";
import { MemoryMappedRegisters } from "./devices.js";
import { VM } from "./index.js";

enum OpCode {
  OP_BR = 0 /* branch */,
  OP_ADD /* add  */,
  OP_LD /* load */,
  OP_ST /* store */,
  OP_JSR /* jump register */,
  OP_AND /* bitwise and */,
  OP_LDR /* load register */,
  OP_STR /* store register */,
  OP_RTI /* unused */,
  OP_NOT /* bitwise not */,
  OP_LDI /* load indirect */,
  OP_STI /* store indirect */,
  OP_JMP /* jump */,
  OP_RES /* reserved (unused) */,
  OP_LEA /* load effective address */,
  OP_TRAP /* execute trap */,
}

enum Trap {
  TRAP_GETC = 0x20 /* get character from keyboard, not echoed onto the terminal */,
  TRAP_OUT = 0x21 /* output a character */,
  TRAP_PUTS = 0x22 /* output a word string */,
  TRAP_IN = 0x23 /* get character from keyboard, echoed onto the terminal */,
  TRAP_PUTSP = 0x24 /* output a byte string */,
  TRAP_HALT = 0x25 /* halt the program */,
}

type OpCodeHandler = (vm: VM, instr: number) => void;
type TrapHandler = (vm: VM) => void;

export const opCodeHandlers: Record<number, OpCodeHandler> = {
  [OpCode.OP_ADD]: function (vm, instr) {
    /* destination register (DR) */
    const r0 = (instr >> 9) & 0x7;
    /* first operand (SR1) */
    const r1 = (instr >> 6) & 0x7;
    /* whether we are in immediate mode */
    const immFlag = (instr >> 5) & 0x1;

    if (immFlag) {
      const imm5 = signExtend(instr & 0x1f, 5);
      vm.registers[r0] = vm.registers[r1] + imm5;
    } else {
      const r2 = instr & 0x7;
      vm.registers[r0] = vm.registers[r1] + vm.registers[r2];
    }

    vm.updateFlags(r0);
  },
  [OpCode.OP_AND]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const r1 = (instr >> 6) & 0x7;
    const immFlag = (instr >> 5) & 0x1;

    if (immFlag) {
      const imm5 = signExtend(instr & 0x1f, 5);
      vm.registers[r0] = vm.registers[r1] & imm5;
    } else {
      const r2 = instr & 0x7;
      vm.registers[r0] = vm.registers[r1] & vm.registers[r2];
    }
    vm.updateFlags(r0);
  },
  [OpCode.OP_NOT]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const r1 = (instr >> 6) & 0x7;

    vm.registers[r0] = ~vm.registers[r1];
    vm.updateFlags(r0);
  },
  [OpCode.OP_BR]: function (vm, instr) {
    const pcOffset = signExtend(instr & 0x1ff, 9);
    const condFlag = (instr >> 9) & 0x7;
    if (condFlag & vm.registers[Register.R_COND]) {
      vm.pc += pcOffset;
    }
  },
  [OpCode.OP_JMP]: function (vm, instr) {
    /* Also handles RET */
    const r1 = (instr >> 6) & 0x7;
    vm.pc = vm.registers[r1];
  },
  [OpCode.OP_JSR]: function (vm, instr) {
    const r1 = (instr >> 6) & 0x7;
    const longPCOffset = signExtend(instr & 0x7ff, 11);
    const longFlag = (instr >> 11) & 1;

    vm.registers[Register.R_R7] = vm.pc;
    if (longFlag) {
      vm.pc += longPCOffset; /* JSR */
    } else {
      vm.pc = vm.registers[r1]; /* JSRR */
    }
  },
  [OpCode.OP_LD]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const pcOffset = signExtend(instr & 0x1ff, 9);
    vm.registers[r0] = vm.read(vm.pc + pcOffset);
    vm.updateFlags(r0);
  },
  [OpCode.OP_LDI]: function (vm, instr) {
    /* destination register (DR) */
    const r0 = (instr >> 9) & 0x7;
    /* PCoffset 9*/
    const pcOffset = signExtend(instr & 0x1ff, 9);

    /* add pc_offset to the current PC, look at that memory location to get the final address */
    vm.registers[r0] = vm.read(vm.read(vm.pc + pcOffset));
    vm.updateFlags(r0);
  },
  [OpCode.OP_LDR]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const r1 = (instr >> 6) & 0x7;
    const offset = signExtend(instr & 0x3f, 6);
    vm.registers[r0] = vm.read(vm.registers[r1] + offset);
    vm.updateFlags(r0);
  },
  [OpCode.OP_LEA]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const pcOffset = signExtend(instr & 0x1ff, 9);
    vm.registers[r0] = vm.pc + pcOffset;
    vm.updateFlags(r0);
  },
  [OpCode.OP_ST]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const pcOffset = signExtend(instr & 0x1ff, 9);
    vm.write(vm.pc + pcOffset, vm.registers[r0]);
  },
  [OpCode.OP_STI]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const pcOffset = signExtend(instr & 0x1ff, 9);
    vm.write(vm.read(vm.pc + pcOffset), vm.registers[r0]);
  },
  [OpCode.OP_STR]: function (vm, instr) {
    const r0 = (instr >> 9) & 0x7;
    const r1 = (instr >> 6) & 0x7;
    const offset = signExtend(instr & 0x3f, 6);
    vm.write(vm.registers[r1] + offset, vm.registers[r0]);
  },
  [OpCode.OP_TRAP]: function (vm, instr) {
    const trapCode = instr & 0xff;
    trapHandlers[trapCode]?.(vm);
  },
};

export const trapHandlers: Record<number, TrapHandler> = {
  [Trap.TRAP_GETC]: function (vm) {
    /* read a single ASCII char */
    vm.registers[Register.R_R0] = vm.read(MemoryMappedRegisters.MR_KBDR);
  },
  [Trap.TRAP_OUT]: function (vm) {
    putBuf([vm.registers[Register.R_R0]]);
  },
  [Trap.TRAP_PUTS]: function (vm) {
    /* one char per word */
    let addr = vm.registers[Register.R_R0];
    const buf: number[] = [];
    while (vm.memory[addr] !== 0) {
      buf.push(vm.memory[addr]);
      addr++;
    }
    putBuf(buf);
  },
  [Trap.TRAP_IN]: function (vm) {
    vm.registers[Register.R_R0] = vm.read(MemoryMappedRegisters.MR_KBDR);
  },
  [Trap.TRAP_PUTSP]: function (vm) {
    /* one char per byte (two bytes per word) here we need to swap back to
     big endian format */
    let addr = vm.registers[Register.R_R0];
    const buf: number[] = [];

    while (vm.memory[addr] !== 0) {
      const char1 = vm.memory[addr] & 0xff;
      buf.push(char1);

      const char2 = vm.memory[addr] >> 8;
      if (char2) {
        buf.push(char2);
      }
      addr++;
    }
    putBuf(buf);
  },
  [Trap.TRAP_HALT]: function (vm) {
    vm.running = false;
  },
};
