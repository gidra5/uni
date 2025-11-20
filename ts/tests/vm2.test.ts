import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { generateVm2Bytecode, InstructionCode, VM } from "../src/vm2/index";
import { validateTokenGroups } from "../src/analysis/validate";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
});

describe("vm2 integration", () => {
  it("adds two numbers and prints the sum", () => {
    const program = `print (1 + 2)`;

    const tokens = parseTokenGroups(program);
    const [, validatedTokens] = validateTokenGroups(tokens);
    const ast = parseScript(validatedTokens);
    const bytecode = generateVm2Bytecode(ast);

    expect(bytecode.main).toEqual([
      { code: InstructionCode.Const, arg1: 1 },
      { code: InstructionCode.Const, arg1: 2 },
      { code: InstructionCode.Add },
      { code: InstructionCode.Native, arg1: "print", arg2: 1 },
      { code: InstructionCode.Return },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const vm = new VM({ code: bytecode, natives: { print: console.log } });
    const result = vm.run();

    expect(result).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(3);
    logSpy.mockRestore();
  });
});
