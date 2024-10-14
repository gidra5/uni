import EventEmitter from "events";
import { Device, MemoryMappedRegisters, displayDevice, keyboardDevice } from "./devices.js";
import { OpCode, opCodeHandlers } from "./handlers.js";
import {
  MEMORY_SIZE,
  R_COUNT,
  Register,
  Address,
  UInt16,
  Flag,
  INITIAL_ADDR,
  PROCESSOR_STATUS_BIT,
  signFlag,
  SUSPENDED_BIT,
  OS_LOADED_BIT,
} from "./utils.js";

class SuspendedError extends Error {
  constructor() {
    super("Suspended");
  }
}

export class VM extends EventEmitter {
  id = 0;
  memory = new Uint16Array(MEMORY_SIZE);
  registers = new Uint16Array(R_COUNT);
  keyboard: Device;
  display: Device;

  constructor(osImage?: Buffer) {
    super();

    const keyboardData = [] as number[];

    this.on("input", (char) => {
      keyboardData.push(char.charCodeAt(0));
    });
    const getChar = () => {
      if (keyboardData.length !== 0) return keyboardData.shift()!;
      this.awaitInput();
      return 0;
    };
    const checkChar = () => {
      if (keyboardData.length !== 0) return true;
      this.awaitInput();
      return false;
    };

    this.keyboard = keyboardDevice(getChar, checkChar);
    this.display = displayDevice;

    this.cond = Flag.ZERO;
    this.pc = INITIAL_ADDR;

    if (osImage) {
      this.loadImage(osImage);
      this.memory[MemoryMappedRegisters.MACHINE_STATUS] |= OS_LOADED_BIT;
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
    return !!(this.memory[MemoryMappedRegisters.MACHINE_STATUS] & (PROCESSOR_STATUS_BIT >> this.id));
  }

  get suspended() {
    return !!(this.memory[MemoryMappedRegisters.MACHINE_STATUS] & (SUSPENDED_BIT >> this.id));
  }

  run() {
    this.memory[MemoryMappedRegisters.MACHINE_STATUS] = PROCESSOR_STATUS_BIT >> this.id;

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
      this.emit("halt");
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
    this.memory[MemoryMappedRegisters.MACHINE_STATUS] |= SUSPENDED_BIT;
    throw new SuspendedError();
  }

  resume() {
    this.memory[MemoryMappedRegisters.MACHINE_STATUS] &= ~SUSPENDED_BIT;
    this.run();
  }

  awaitInput() {
    this.once("input", () => {
      this.resume();
    });
    this.suspend();
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
