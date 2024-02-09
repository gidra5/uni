export type MemoryMappedDevice = (memory: Uint16Array) => Device;

export type Device = {
  read: (address: number) => number;
  write: (address: number, val: number) => void;
};

/** Memory Mapped Registers */
export enum MemoryMappedRegisters {
  MR_KBSR = 0xfe00 /* keyboard status */,
  MR_KBDR = 0xfe02 /* keyboard data */,
}

export const keyboardDevice =
  (getChar: () => number): MemoryMappedDevice =>
  (memory) => ({
    read(address: number) {
      if (address === MemoryMappedRegisters.MR_KBSR) {
        const input = getChar();
        if (input) {
          memory[MemoryMappedRegisters.MR_KBSR] = 1 << 15;
          memory[MemoryMappedRegisters.MR_KBDR] = input;
        } else {
          memory[MemoryMappedRegisters.MR_KBSR] = 0;
        }
      }
      return memory[address];
    },
    write() {},
  });
