import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { generateVm2Bytecode, InstructionCode, VM } from "../src/vm/index";
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
    const vm = new VM({ code: bytecode, natives: { print: (_vm, [value]) => console.log(value) } });
    const result = vm.run();

    expect(result).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(3);
    logSpy.mockRestore();
  });

  describe("instructions", () => {
    it("handles arithmetic chain", () => {
      const vm = new VM({
        code: {
          main: [
            { code: InstructionCode.Const, arg1: 2 },
            { code: InstructionCode.Const, arg1: 3 },
            { code: InstructionCode.Add }, // 5
            { code: InstructionCode.Const, arg1: 4 },
            { code: InstructionCode.Mul }, // 20
            { code: InstructionCode.Const, arg1: 5 },
            { code: InstructionCode.Sub }, // 15
            { code: InstructionCode.Const, arg1: 3 },
            { code: InstructionCode.Div }, // 5
            { code: InstructionCode.Const, arg1: 2 },
            { code: InstructionCode.Pow }, // 25
            { code: InstructionCode.Const, arg1: 6 },
            { code: InstructionCode.Mod }, // 1
            { code: InstructionCode.Return },
          ],
        },
      });

      expect(vm.run()).toBe(1);
    });

    it("supports boolean ops and comparisons", () => {
      const vm = new VM({
        code: {
          main: [
            { code: InstructionCode.Const, arg1: true },
            { code: InstructionCode.Const, arg1: false },
            { code: InstructionCode.And }, // false
            { code: InstructionCode.Const, arg1: true },
            { code: InstructionCode.Or }, // true
            { code: InstructionCode.Not }, // false
            { code: InstructionCode.Const, arg1: 3 },
            { code: InstructionCode.Const, arg1: 3 },
            { code: InstructionCode.Eq }, // true
            { code: InstructionCode.And }, // false && true -> false
            { code: InstructionCode.Const, arg1: 5 },
            { code: InstructionCode.Const, arg1: 1 },
            { code: InstructionCode.Gt }, // true
            { code: InstructionCode.Or }, // false || true -> true
            { code: InstructionCode.Return },
          ],
        },
      });

      expect(vm.run()).toBe(true);
    });

    it("jumps within a function", () => {
      const vm = new VM({
        code: {
          main: [
            { code: InstructionCode.Const, arg1: 1 },
            { code: InstructionCode.Jump, arg1: 3 },
            { code: InstructionCode.Const, arg1: 99 }, // skipped
            { code: InstructionCode.Const, arg1: 2 },
            { code: InstructionCode.Add },
            { code: InstructionCode.Return },
          ],
        },
      });

      expect(vm.run()).toBe(3);
    });

    it("allocates and frees heap entries", () => {
      const vm = new VM({
        code: {
          main: [
            { code: InstructionCode.Const, arg1: 42 },
            { code: InstructionCode.Alloc, arg1: "x" },
            { code: InstructionCode.Free, arg1: "x" },
            { code: InstructionCode.Return },
          ],
        },
      });

      const result = vm.run();
      expect(result).toEqual({ ref: "x" });
      expect(vm.heap["x"]).toBeUndefined();
    });

    it("calls and returns from another function", () => {
      const vm = new VM({
        code: {
          main: [
            { code: InstructionCode.Const, arg1: 5 },
            { code: InstructionCode.Const, arg1: 7 },
            { code: InstructionCode.Call, arg1: "sum", arg2: 2 },
            { code: InstructionCode.Return },
          ],
          sum: [
            { code: InstructionCode.Add },
            { code: InstructionCode.Return },
          ],
        },
      });

      expect(vm.run()).toBe(12);
    });
  });
});
