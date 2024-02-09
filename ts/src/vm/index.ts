import { MEMORY_SIZE, R_COUNT, Register } from "./memory.js";
import { MemoryMappedDevice, Device } from "./devices.js";
import { opCodeHandlers } from "./handlers.js";

const SIGN_BIT = 1 << 15;

enum Flag {
  FL_POS = 1 << 0 /* P */,
  FL_ZRO = 1 << 1 /* Z */,
  FL_NEG = 1 << 2 /* N */,
}

export class VM {
  memory = new Uint16Array(MEMORY_SIZE);
  registers = new Uint16Array(R_COUNT);
  running = true;
  keyboard: Device;

  constructor(keyboard: MemoryMappedDevice) {
    this.keyboard = keyboard(this.memory);
  }

  get pc() {
    return this.registers[Register.R_PC];
  }

  set pc(val: number) {
    this.registers[Register.R_PC] = val;
  }

  run(image: Buffer) {
    this.loadImage(image);
    this.running = true;

    while (this.running) {
      const instr = this.read(this.pc++);
      const op = instr >> 12;
      const handler = opCodeHandlers[op];

      if (!handler) process.exit(-1);

      handler(this, instr);
    }
  }

  updateFlags(register: Register) {
    if (this.registers[register] === 0) {
      this.registers[Register.R_COND] = Flag.FL_ZRO;
    } else if (this.registers[register] & SIGN_BIT) {
      /* a 1 in the left-most bit indicates negative */
      this.registers[Register.R_COND] = Flag.FL_NEG;
    } else {
      this.registers[Register.R_COND] = Flag.FL_POS;
    }
  }

  write(address: number, val: number) {
    this.memory[address] = val;
  }

  read(address: number): number {
    this.keyboard.read(address);
    return this.memory[address];
  }

  loadImage(image: Buffer) {
    /* the origin tells us where in memory to place the image */
    let pos = 0;
    const origin = image.readUInt16BE(pos);
    pos += 2;

    this.pc = origin;
    this.memory.set(image.subarray(pos), origin);
  }
}
