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

const parseProgram = (program: string) => {
  const tokens = parseTokenGroups(program);
  const [, validatedTokens] = validateTokenGroups(tokens);
  const ast = parseScript(validatedTokens);
  const bytecode = generateVm2Bytecode(ast);
  return bytecode;
};

describe("vm2 integration", () => {
  it("adds two numbers and prints the sum", () => {
    const program = `print (1 + 2)`;
    const bytecode = parseProgram(program);

    expect(bytecode).toMatchSnapshot();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const vm = new VM({ code: bytecode, natives: { print: (_vm, [value]) => console.log(value) } });
    const result = vm.run();

    expect(result).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(3);
    logSpy.mockRestore();
  });
});