import { MemoryMappedDevice, Device, MemoryMappedRegisters, displayDevice } from "./devices.js";
import { OpCode, opCodeHandlers } from "./handlers.js";
import {
  MEMORY_SIZE,
  R_COUNT,
  Register,
  Address,
  UInt16,
  Flag,
  INITIAL_ADDR,
  STATUS_BIT,
  signFlag,
  SUSPENDED_BIT,
  OS_LOADED_BIT,
} from "./utils.js";

class SuspendedError extends Error {
  constructor() {
    super("Suspended");
  }
}

export class VM {
  memory = new Uint16Array(MEMORY_SIZE);
  registers = new Uint16Array(R_COUNT);
  keyboard: Device;
  display: Device;

  constructor(keyboard: Device, osImage?: Buffer) {
    this.keyboard = keyboard;
    this.display = displayDevice;

    this.cond = Flag.ZERO;
    this.pc = INITIAL_ADDR;
    this.memory[MemoryMappedRegisters.MSR] = STATUS_BIT;

    if (osImage) {
      this.loadImage(osImage);
      this.memory[MemoryMappedRegisters.MSR] |= OS_LOADED_BIT;
    }
  }

  get pc() {
    return this.registers[Register.R_PC];
  }

  set pc(val: UInt16) {
    this.registers[Register.R_PC] = val;
  }

  set cond(val: Flag) {
    this.registers[Register.R_COND] = val;
  }

  get cond() {
    return this.registers[Register.R_COND];
  }

  get running() {
    return !!(this.memory[MemoryMappedRegisters.MSR] & STATUS_BIT);
  }

  get suspended() {
    return !!(this.memory[MemoryMappedRegisters.MSR] & SUSPENDED_BIT);
  }

  run() {
    try {
      while (this.running && !this.suspended) {
        const instr = this.read(this.pc++);
        const op: OpCode = instr >> 12;
        const handler = opCodeHandlers[op];

        if (!handler) {
          console.log(OpCode[op], "not implemented");
          return;
        }

        handler(this, instr);
      }
      process.exit(0);
    } catch (e) {
      if (!(e instanceof SuspendedError)) throw e;
    }
  }

  updateFlags(register: Register) {
    const val = this.registers[register];
    this.cond = signFlag(val);
  }

  write(address: Address, val: UInt16) {
    if (this.keyboard.write(address, val)) return;
    if (this.display.write(address, val)) return;
    this.memory[address] = val;
  }

  read(address: Address): UInt16 {
    let value = this.keyboard.read(address);
    if (value !== null) return value;

    value = this.display.read(address);
    if (value !== null) return value;

    return this.memory[address];
  }

  suspend() {
    this.memory[MemoryMappedRegisters.MSR] |= SUSPENDED_BIT;
    throw new SuspendedError();
  }

  resume() {
    this.memory[MemoryMappedRegisters.MSR] &= ~SUSPENDED_BIT;
    this.run();
  }

  loadImage(buffer: Buffer) {
    // https://stackoverflow.com/questions/59996221/convert-nodejs-buffer-to-uint16array
    buffer.swap16();

    let image = new Uint16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    let origin: Address = image[0];
    this.pc = origin;
    image = image.subarray(1);

    if (origin + image.length >= MEMORY_SIZE) {
      throw new Error("Image too big to fit in memory");
    }

    this.memory.set(image, origin);
  }
}
