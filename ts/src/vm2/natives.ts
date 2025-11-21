import type { NativeHandler } from ".";

export const defaultNatives: Record<string, NativeHandler> = {
  print: (_vm, [value]) => {
    console.log(value);
    return value;
  },
};

export const mergeNatives = (natives?: Record<string, NativeHandler>): Record<string, NativeHandler> => ({
  ...defaultNatives,
  ...(natives ?? {}),
});
