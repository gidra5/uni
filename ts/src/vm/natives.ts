import type { NativeHandler } from ".";
import { assert } from "../utils";

export const defaultNatives: Record<string, NativeHandler> = {
  print: (_vm, [value]) => {
    console.log(value);
    return value;
  },
  symbol: (vm, [name]) => {
    const description = name === undefined ? undefined : String(name);
    return vm.createSymbol(description, false);
  },

  alloc: (vm, [value]) => {
    return vm.alloc(value);
  },
  free: (vm, [ref]) => {
    assert(typeof ref === "object" && ref && "ref" in ref);
    vm.free(ref.ref);
    return null;
  },
};

export const mergeNatives = (natives?: Record<string, NativeHandler>): Record<string, NativeHandler> => ({
  ...defaultNatives,
  ...(natives ?? {}),
});
