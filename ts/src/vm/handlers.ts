import {
  Address,
  Flag,
  OS_LOADED_BIT,
  Register,
  STATUS_BIT,
  UInt16,
  putBuf,
  signExtend,
  toBin,
  toHex,
} from "./utils.js";
import { VM } from "./index.js";
import { MemoryMappedRegisters } from "./devices.js";

export enum OpCode {
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
  OP_SHIFT /* shift */,
  OP_NAND /* bitwise nand */,
  OP_MULT /* multiply */,

  /* 
  VM_OPCODE_ADD = 0b0001,
  VM_OPCODE_AND = 0b0101,
  VM_OPCODE_BR = 0b0000,
  VM_OPCODE_JMP = 0b1100,
  VM_OPCODE_JSR = 0b0100,
  VM_OPCODE_LD = 0b0010,
  VM_OPCODE_LDI = 0b1010,
  VM_OPCODE_LDR = 0b0110,
  VM_OPCODE_LEA = 0b1110,
  VM_OPCODE_NOT = 0b1001,
  VM_OPCODE_RTI = 0b1000,
  VM_OPCODE_ST = 0b0011,
  VM_OPCODE_STI = 0b1011,
  VM_OPCODE_STR = 0b0111,
  VM_OPCODE_TRAP = 0b1111,
  VM_OPCODE_RESERVED = 0b1101,
  */
}

export enum TrapCode {
  TRAP_GETC = 0x20 /* get character from keyboard, not echoed onto the terminal */,
  TRAP_OUT = 0x21 /* output a character */,
  TRAP_PUTS = 0x22 /* output a word string */,
  TRAP_IN = 0x23 /* get character from keyboard, echoed onto the terminal */,
  TRAP_PUTSP = 0x24 /* output a byte string */,
  TRAP_HALT = 0x25 /* halt the program */,
}

type OpCodeHandler = (vm: VM, instr: number) => void;
type TrapHandler = (vm: VM) => void;

// 8bit command, 4 opcodes, 8 registers (with pc register)
export const opCodeHandlers4: Record<number, OpCodeHandler> = {
  [OpCode.OP_NAND]: function (vm, instr) {
    /* opcode XX | src XXX | valueReg XXX */
    const srcReg: Register = (instr >> 3) & 0b111;
    const value: UInt16 = vm.registers[instr & 0b111];

    vm.registers[srcReg] = ~(vm.registers[srcReg] & value);

    vm.updateFlags(srcReg);
  },
  [OpCode.OP_SHIFT]: function (vm, instr) {
    /* opcode: XX | srcReg XXX | valueReg XXX */
    const srcReg: Register = (instr >> 3) & 0b111;
    const value: UInt16 = vm.registers[instr & 0b111];

    vm.registers[srcReg] = vm.registers[srcReg] << value;

    vm.updateFlags(srcReg);
  },
  [OpCode.OP_LD]: function (vm, instr) {
    /* opcode XX | dest XXX | addrReg XXX */
    const destReg: Register = (instr >> 3) & 0b111;
    const addrReg: Register = instr & 0b111;

    vm.registers[destReg] = vm.read(vm.registers[addrReg]);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_ST]: function (vm, instr) {
    /* opcode XX | src XXX | addrReg XXX */
    const srcReg: Register = (instr >> 3) & 0b111;
    const addrReg: Register = instr & 0b111;

    vm.write(vm.registers[addrReg], vm.registers[srcReg]);
  },
};

// 8bit command, 4 opcodes, 4 registers (with pc register)
export const opCodeHandlers3: Record<number, OpCodeHandler> = {
  [OpCode.OP_NAND]: function (vm, instr) {
    /* opcode XX | dest XX | src XX | valueReg XX */
    const destReg: Register = (instr >> 4) & 0b11;
    const srcReg: Register = (instr >> 2) & 0b11;
    const value: UInt16 = vm.registers[instr & 0b11];

    vm.registers[destReg] = ~(vm.registers[srcReg] & value);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_SHIFT]: function (vm, instr) {
    /* opcode: XX | destReg XX | srcReg XX | valueReg XX */
    const destReg: Register = (instr >> 4) & 0b11;
    const srcReg: Register = (instr >> 2) & 0b11;
    const value: UInt16 = vm.registers[instr & 0b11];

    vm.registers[destReg] = vm.registers[srcReg] << value;

    vm.updateFlags(destReg);
  },
  [OpCode.OP_LD]: function (vm, instr) {
    /* opcode XX | dest XX | baseReg XX | offsetReg XX */
    const destReg: Register = (instr >> 4) & 0b11;
    const baseReg: Register = (instr >> 2) & 0b11;
    const offset: Address = vm.registers[instr & 0b11];

    vm.registers[destReg] = vm.read(vm.registers[baseReg] + offset);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_ST]: function (vm, instr) {
    /* opcode XX | src XX | baseReg XX | offsetReg XX */
    const srcReg: Register = (instr >> 4) & 0b11;
    const baseReg: Register = (instr >> 2) & 0b11;
    const offset: Address = vm.registers[instr & 0b11];

    vm.write(vm.registers[baseReg] + offset, vm.registers[srcReg]);
  },
};

// 16bit command, 8 opcodes, 8 registers
export const opCodeHandlers2: Record<number, OpCodeHandler> = {
  [OpCode.OP_ADD]: function (vm, instr) {
    /* opcode XXX | dest XXX | src XXX | imm 1 | value XXXXXX */
    /* opcode XXX | dest XXX | src XXX | imm 0 | XXX | valueReg XXX */

    const destReg = (instr >> 10) & 0b111;
    const srcReg1 = (instr >> 7) & 0b111;
    /* whether we are in immediate mode */
    const immFlag = instr & (1 << 6);
    const value = immFlag ? signExtend(instr, 6) : vm.registers[instr & 0b111];

    vm.registers[destReg] = vm.registers[srcReg1] + value;
    // console.log("VM_OPCODE_ADD dr %d sr1 %d val %d", destReg, srcReg1, value);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_NAND]: function (vm, instr) {
    /* opcode XXX | dest XXX | src XXX | imm 1 | value XXXXXX */
    /* opcode XXX | dest XXX | src XXX | imm 0 | XXX | valueReg XXX */
    const destReg: Register = (instr >> 10) & 0b111;
    const srcReg1: Register = (instr >> 6) & 0b111;
    const immFlag: UInt16 = instr & (1 << 5);
    const value: UInt16 = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];

    vm.registers[destReg] = ~(vm.registers[srcReg1] & value);
    // console.log("VM_OPCODE_NAND dr %d sr1 %d val %d", destReg, srcReg1, value);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_BR]: function (vm, instr) {
    /* opcode XXX | mask XXX | pcBase 1 | offset XXXXXXXXX*/
    /* opcode XXX | mask XXX | pcBase 0 | baseReg XXX | imm 1 | offset XXXXX */
    /* opcode XXX | mask XXX | pcBase 0 | baseReg XXX | imm 0 | XX | offsetReg XXX*/
    const currentCond: UInt16 = vm.cond & 0b111;
    const desiredCond: UInt16 = (instr >> 10) & 0b111;
    if (!(currentCond & desiredCond)) return;

    const pcBaseFlag: UInt16 = instr & (1 << 9);

    if (pcBaseFlag) {
      const offset: Address = signExtend(instr, 9);
      vm.pc += offset;
    } else {
      const baseReg: Register = (instr >> 6) & 0b111;
      const immFlag: UInt16 = instr & (1 << 5);
      const offset: Address = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];
      const pc: Address = vm.registers[baseReg] + offset;
      // console.log("VM_OPCODE_BR desired_cond %s pc_offset9 %d", toBin(desiredCond, 3), offset);

      vm.pc = pc;
    }
  },
  [OpCode.OP_SHIFT]: function (vm, instr) {
    /* opcode: XXX | destReg XXX | srcReg XXX | fill X | imm 1 | value XXXXX */
    /* opcode: XXX | destReg XXX | srcReg XXX | fill X | imm 0 | XX | valueReg XXX */
    const destReg: Register = (instr >> 10) & 0b111;
    const srcReg: Register = (instr >> 7) & 0b111;
    const type: UInt16 = instr & (1 << 6);
    const immFlag: UInt16 = instr & (1 << 5);
    const amount: UInt16 = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];
    // console.log("VM_OPCODE_SHIFT dest %s src %s type %d imm %d amount %d", toBin(desiredCond, 3), offset);

    let fill = type ? ~(-1 << amount) : 0x0;
    vm.registers[destReg] = (vm.registers[srcReg] << amount) | fill;

    vm.updateFlags(destReg);
  },
  [OpCode.OP_LD]: function (vm, instr) {
    /* opcode XXX | dest XXX | pcBase 1 | offset XXXXXXXXX */
    /* opcode XXX | dest XXX | pcBase 0 | baseReg XXX | imm 1 | offset XXXXX */
    /* opcode XXX | dest XXX | pcBase 0 | baseReg XXX | imm 0 | XX | offsetReg XXX */
    const destReg: Register = (instr >> 10) & 0b111;
    const pcBaseFlag: UInt16 = instr & (1 << 9);

    if (pcBaseFlag) {
      const offset: Address = signExtend(instr, 9);
      vm.registers[destReg] = vm.read(vm.pc + offset);
    } else {
      const baseReg: Register = (instr >> 6) & 0b111;
      const immFlag: UInt16 = instr & (1 << 5);
      const offset: Address = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];
      vm.registers[destReg] = vm.read(vm.registers[baseReg] + offset);
    }

    vm.updateFlags(destReg);
  },
  [OpCode.OP_LDI]: function (vm, instr) {
    /* opcode XXX | dest XXX | offset XX_XXXX_XXXX */
    const destReg: Register = (instr >> 10) & 0b111;
    const offset: Address = signExtend(instr, 10);

    vm.registers[destReg] = vm.read(vm.read(vm.pc + offset));

    // console.log("VM_OPCODE_LDI dr %s pc_offset9 %d val %d", Register[destReg], offset, vm.registers[destReg]);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_ST]: function (vm, instr) {
    /* opcode XXX | src XXX | pcBase 1 | offset XXXXXXXXX */
    /* opcode XXX | src XXX | pcBase 0 | baseReg XXX | imm 1 | offset XXXXX */
    /* opcode XXX | src XXX | pcBase 0 | baseReg XXX | imm 0 | XX | offsetReg XXX */
    const srcReg: Register = (instr >> 10) & 0b111;
    const value: UInt16 = vm.registers[srcReg];
    const pcBaseFlag: UInt16 = instr & (1 << 9);

    if (pcBaseFlag) {
      const offset: Address = signExtend(instr, 9);
      vm.write(vm.pc + offset, value);
    } else {
      const baseReg: Register = (instr >> 6) & 0b111;
      const immFlag: UInt16 = instr & (1 << 5);
      const offset: Address = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];
      vm.write(vm.registers[baseReg] + offset, value);
    }
  },
  [OpCode.OP_STI]: function (vm, instr) {
    /* opcode XXX | dest XXX | offset XX_XXXX_XXXX */
    const srcReg: Register = (instr >> 10) & 0b111;
    const offset: Address = signExtend(instr, 10);
    // console.log("VM_OPCODE_STI sr %d pc_offset9 %d", srcReg, offset);

    vm.write(vm.read(vm.pc + offset), vm.registers[srcReg]);
  },
};

// 16bit command, 16 opcodes, 8 registers
export const opCodeHandlers: Record<number, OpCodeHandler> = {
  [OpCode.OP_ADD]: function (vm, instr) {
    /* opcode XXXX | dest XXX | src XXX | imm 1 | value XXXXX */
    /* opcode XXXX | dest XXX | src XXX | imm 0 | XX | valueReg XXX */
    const destReg = (instr >> 9) & 0b111;
    const srcReg1 = (instr >> 6) & 0b111;
    /* whether we are in immediate mode */
    const immFlag = instr & (1 << 5);
    const value = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];

    vm.registers[destReg] = vm.registers[srcReg1] + value;
    // console.log("VM_OPCODE_ADD dr %d sr1 %d val %d", destReg, srcReg1, value);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_AND]: function (vm, instr) {
    /* opcode XXXX | dest XXX | src XXX | imm 1 | value XXXXX */
    /* opcode XXXX | dest XXX | src XXX | imm 0 | XX | valueReg XXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const srcReg1: Register = (instr >> 6) & 0b111;
    const immFlag: UInt16 = instr & (1 << 5);
    const value: UInt16 = immFlag ? signExtend(instr, 5) : vm.registers[instr & 0b111];

    vm.registers[destReg] = vm.registers[srcReg1] & value;
    // console.log("VM_OPCODE_AND dr %d sr1 %d val %d", destReg, srcReg1, value);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_NOT]: function (vm, instr) {
    /* opcode XXXX | dest XXX | src XXX | XXXXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const srcReg: Register = (instr >> 6) & 0b111;
    // console.log("VM_OPCODE_NOT dr %d sr %d", destReg, srcReg);

    vm.registers[destReg] = ~vm.registers[srcReg];
    vm.updateFlags(destReg);
  },
  [OpCode.OP_BR]: function (vm, instr) {
    /* opcode XXXX | mask XXX | offset X_XXXX_XXXX */
    const currentCond: UInt16 = vm.cond & 0b111;
    const desiredCond: UInt16 = (instr >> 9) & 0b111;
    if (!(currentCond & desiredCond)) return;

    const offset: Address = signExtend(instr, 9);
    // console.log("VM_OPCODE_BR desired_cond %s pc_offset9 %d", toBin(desiredCond, 3), offset);

    vm.pc += offset;
  },
  [OpCode.OP_JMP]: function (vm, instr) {
    /* opcode XXXX | XXX | baser XXX | XX_XXXX */
    const baseReg: Register = (instr >> 6) & 0b111;
    // console.log("VM_OPCODE_JMP baser %d", baseReg);

    vm.pc = vm.registers[baseReg];
  },
  [OpCode.OP_JSR]: function (vm, instr) {
    /* opcode XXXX | long 1 | offset XXX_XXXX_XXXX */
    /* opcode XXXX | long 0 | XX | baser XXX | XX_XXXX */
    const originalPC: Address = vm.pc;

    if (instr & (1 << 11)) {
      const offset: Address = signExtend(instr, 11);
      // console.log("VM_OPCODE_JSR long_pc_offset11 %d", offset);

      vm.pc += offset;
    } else {
      const baseReg: Register = (instr >> 6) & 0b111;
      const baseRegVal: Register = vm.registers[baseReg];
      // console.log("VM_OPCODE_JSR baser %d baser_val %d", baseReg, baseRegVal);

      vm.pc = baseRegVal;
    }

    vm.registers[Register.R_R7] = originalPC;
  },
  [OpCode.OP_LEA]: function (vm, instr) {
    /* opcode XXXX | dest XXX | offset X_XXXX_XXXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const offset: Address = signExtend(instr, 9);
    // console.log("VM_OPCODE_LEA dr %d pc_offset9 %d", destReg, offset);

    vm.registers[destReg] = vm.pc + offset;
    vm.updateFlags(destReg);
  },
  [OpCode.OP_LD]: function (vm, instr) {
    /* opcode XXXX | dest XXX | offset X_XXXX_XXXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const offset: Address = signExtend(instr, 9);
    // console.log("VM_OPCODE_LD dr %d pc_offset9 %d", destReg, offset);

    vm.registers[destReg] = vm.read(vm.pc + offset);
    vm.updateFlags(destReg);
  },
  [OpCode.OP_LDI]: function (vm, instr) {
    /* opcode XXXX | dest XXX | offset X_XXXX_XXXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const offset: Address = signExtend(instr, 9);

    vm.registers[destReg] = vm.read(vm.read(vm.pc + offset));

    // console.log("VM_OPCODE_LDI dr %s pc_offset9 %d val %d", Register[destReg], offset, vm.registers[destReg]);

    vm.updateFlags(destReg);
  },
  [OpCode.OP_LDR]: function (vm, instr) {
    /* opcode XXXX | dest XXX | baser XXX | offset XX_XXXX */
    const destReg: Register = (instr >> 9) & 0b111;
    const baseReg: Register = (instr >> 6) & 0b111;
    const offset: Address = signExtend(instr, 6);
    // console.log("VM_OPCODE_LDR dr %d baser %d offset6 %d", destReg, baseReg, offset);

    vm.registers[destReg] = vm.read(vm.registers[baseReg] + offset);
    vm.updateFlags(destReg);
  },
  [OpCode.OP_ST]: function (vm, instr) {
    /* opcode XXXX | src XXX | offset X_XXXX_XXXX */
    const srcReg: Register = (instr >> 9) & 0b111;
    const offset: Address = signExtend(instr, 9);
    // const offset: Address = instr & 0x1ff;
    // console.log("VM_OPCODE_ST sr %s pc_offset9 %d", Register[srcReg], offset);

    vm.write(vm.pc + offset, vm.registers[srcReg]);
  },
  [OpCode.OP_STI]: function (vm, instr) {
    /* opcode XXXX | src XXX | offset X_XXXX_XXXX */
    const srcReg: Register = (instr >> 9) & 0b111;
    const offset: Address = signExtend(instr, 9);
    // console.log("VM_OPCODE_STI sr %d pc_offset9 %d", srcReg, offset);

    vm.write(vm.read(vm.pc + offset), vm.registers[srcReg]);
  },
  [OpCode.OP_STR]: function (vm, instr) {
    /* opcode XXXX | src XXX | baser XXX | offset XX_XXXX */
    const srcReg: Register = (instr >> 9) & 0b111;
    const baseReg: Register = (instr >> 6) & 0b111;
    const offset: Address = signExtend(instr, 6);
    // console.log("VM_OPCODE_STR sr %d baser %d offset6 %d", srcReg, baseReg, offset);

    vm.write(vm.registers[baseReg] + offset, vm.registers[srcReg]);
  },
  [OpCode.OP_TRAP]: function (vm, instr) {
    /* opcode XXXX | XXXX | trapvect8 XXXX_XXXX */
    const trapCode: Address = instr & 0xff;
    // console.log("VM_OPCODE_TRAP trapvect8 %s", toHex(trapCode));

    // if os is loaded use its implementation, otherwise use native
    if (vm.memory[MemoryMappedRegisters.MSR] & OS_LOADED_BIT) {
      vm.registers[Register.R_R7] = vm.pc;
      vm.pc = vm.read(trapCode);
    } else trapHandlers[trapCode]?.(vm);
  },
};

export const trapHandlers: Record<number, TrapHandler> = {
  [TrapCode.TRAP_GETC]: function (vm) {
    /* read a single ASCII char */
    vm.registers[Register.R_R0] = vm.read(MemoryMappedRegisters.KBDR);
  },
  [TrapCode.TRAP_OUT]: function (vm) {
    putBuf([vm.registers[Register.R_R0]]);
  },
  [TrapCode.TRAP_PUTS]: function (vm) {
    /* one char per word */
    let addr = vm.registers[Register.R_R0];
    const buf: number[] = [];
    while (vm.memory[addr] !== 0) {
      buf.push(vm.memory[addr]);
      addr++;
    }
    putBuf(buf);
  },
  [TrapCode.TRAP_IN]: function (vm) {
    vm.registers[Register.R_R0] = vm.read(MemoryMappedRegisters.KBDR);
  },
  [TrapCode.TRAP_PUTSP]: function (vm) {
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
  [TrapCode.TRAP_HALT]: function (vm) {
    vm.memory[MemoryMappedRegisters.MSR] &= ~STATUS_BIT;
  },
};
