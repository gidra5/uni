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
  toHex,
  toBin,
} from "./utils.js";

class SuspendedError extends Error {
  constructor() {
    super("Suspended");
  }
}

export class VM {
  memory = new Uint16Array(MEMORY_SIZE);
  registers = new Uint16Array(R_COUNT);
  suspended = false;
  keyboard: Device;
  display: Device;

  constructor(keyboard: MemoryMappedDevice, osImage?: Buffer) {
    this.keyboard = keyboard(this.memory);
    this.display = displayDevice(this.memory);

    this.cond = Flag.ZERO;
    this.pc = INITIAL_ADDR;
    this.memory[MemoryMappedRegisters.MCR] = STATUS_BIT;

    if (osImage) this.loadImage(osImage);
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

  run() {
    // let counter = 0;

    try {
      while (this.read(MemoryMappedRegisters.MCR) & STATUS_BIT && !this.suspended) {
        // counter++;
        // if (counter > 10000) {
        //   console.log("Infinite loop detected");
        //   break;
        // }

        // const values = [...this.registers.values()];
        // const cond = values.pop()!;
        // const pc = values.pop()!;
        // process.stdout.write("\n");
        // process.stdout.write(toHex(pc) + " ");
        // process.stdout.write(toBin(cond, 4) + " ");
        // process.stdout.write(values.map(toHex) + "\n");
        // process.stdout.write([...this.memory.subarray(pc - 20, pc + 2).values()].map(toHex) + "\n");

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
      if (!(e instanceof SuspendedError)) {
        throw e;
      }
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
    // console.log("suspended");

    this.suspended = true;
    throw new SuspendedError();
  }

  resume() {
    // console.log("resumed");
    this.suspended = false;
    this.run();
  }

  loadImage(image: Buffer) {
    let origin: Address = image.readUInt16BE(0);
    this.pc = origin;
    image = image.subarray(2);

    if (origin + image.length >= MEMORY_SIZE) {
      throw new Error("Image too big to fit in memory");
    }

    while (image.length > 0) {
      this.memory[origin++] = image.readUInt16BE(0);
      image = image.subarray(2);
    }
  }
}
