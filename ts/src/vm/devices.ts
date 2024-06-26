import { STATUS_BIT } from "./utils.js";

export type MemoryMappedDevice = {
  device: Device;
  range: [number, number];
};

export type Device = {
  read(address: number): number | null;
  write(address: number, val: number): boolean;
};

export enum MemoryMappedRegisters {
  DSR = 0xfe04 /* display status */,
  DDR = 0xfe06 /* display data */,
  MACHINE_STATUS = 0xfffe,
  KBSR = 0xfe00 /* keyboard status */,
  KBDR = 0xfe02 /* keyboard data */,
}

export const keyboardDevice = (getChar: () => number, checkChar: () => boolean): Device => ({
  read(address) {
    if (address === MemoryMappedRegisters.KBSR) {
      const input = checkChar();
      return input ? STATUS_BIT : 0;
    } else if (address === MemoryMappedRegisters.KBDR) {
      if (this.read(MemoryMappedRegisters.KBSR)) {
        return getChar();
      }
      return 0;
    }
    return null;
  },
  write(address) {
    return address === MemoryMappedRegisters.KBSR || address === MemoryMappedRegisters.KBDR;
  },
});

export const displayDevice: Device = {
  read(address: number) {
    if (address === MemoryMappedRegisters.DSR) {
      return STATUS_BIT;
    } else if (address === MemoryMappedRegisters.DDR) {
      return 0;
    }
    return null;
  },
  write(address: number, val: number) {
    if (address === MemoryMappedRegisters.DDR) {
      process.stdout.write(String.fromCharCode(val));
      return true;
    }
    return address === MemoryMappedRegisters.DSR;
  },
};
