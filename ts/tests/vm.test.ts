import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { generateVm2Bytecode, VM, type Program } from "../src/vm/index";
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

const runProgram = (program: string | Program, options: Partial<ConstructorParameters<typeof VM>[0]> = {}) => {
  const bytecode = typeof program === "string" ? parseProgram(program) : program;
  const vm = new VM({ code: bytecode, ...options });
  const result = vm.run();
  return { bytecode, result, vm };
};

describe("expressions", () => {
  describe("values", () => {
    const cases = [
      { name: "integer", program: "123", expected: 123 },
      { name: "float", program: "123.456", expected: 123.456 },
      { name: "string", program: '"string"', expected: "string" },
      { name: "string template", program: '"hello \\(1) world"', expected: "hello 1 world" },
      { name: "true", program: "true", expected: true },
      { name: "false", program: "false", expected: false },
      { name: "atom", program: "$atom", expected: { symbol: "atom:atom", name: "atom" } },
    ];

    for (const { name, program, expected } of cases) {
      it(name, () => {
        const { bytecode, result } = runProgram(program);
        expect(bytecode).toMatchSnapshot();
        expect(result).toEqual(expected);
      });
    }
  });

  describe("arithmetics", () => {
    it("handles chained math with precedence", () => {
      const { bytecode, result } = runProgram("1 + 2^-3 * 4 - 5 / 6 % 7");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBeCloseTo(0.6666666666666666);
    });
  });

  describe("boolean expressions", () => {
    it("not on not boolean", () => {
      const { bytecode, result } = runProgram("!123");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it("not on boolean", () => {
      const { bytecode, result } = runProgram("!true");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it("and", () => {
      const { bytecode, result } = runProgram("true and false");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it("and short-circuit", () => {
      const { bytecode, result } = runProgram("false and whatever");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it("or", () => {
      const { bytecode, result } = runProgram("true or false");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("or short-circuit", () => {
      const { bytecode, result } = runProgram("true or whatever");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("in", () => {
      const { bytecode, result } = runProgram("$key in (key: 1, key2: 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("eq", () => {
      const { bytecode, result } = runProgram("1 == 1");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("eq ref", () => {
      const { bytecode, result } = runProgram("x := 1, 2; y := x; x == y");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("eq ref 2", () => {
      const { bytecode, result } = runProgram("(1, 2) == (1, 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it("deep eq", () => {
      const { bytecode, result } = runProgram("(1, 2) === (1, 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it("compare", () => {
      const { bytecode, result } = runProgram("123 < 456");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });
  });

  describe("symbols", () => {
    it("creates a named symbol", () => {
      const { bytecode, result } = runProgram('symbol "foo"');
      expect(bytecode).toMatchSnapshot();
      expect(result).toMatchObject({ name: "foo", symbol: expect.any(Number) });
    });

    it("symbol equality is by identity, atoms are by name", () => {
      const { bytecode, result } = runProgram('s := symbol "a"; t := symbol "a"; s == t');
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);

      const { result: atomResult } = runProgram("$a == $a");
      expect(atomResult).toBe(true);
    });
  });

  describe("memory ops", () => {
    it("alloc stores value and returns it via load", () => {
      const program = "r := alloc 42; *r";
      const { bytecode, result, vm } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(42);
      expect(vm.heap).toMatchSnapshot();
    });

    it("free removes stored value", () => {
      const program = "r := alloc 7; free r";
      const { bytecode, result, vm } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBeNull();
      expect(Object.keys(vm.heap).filter((k) => k.startsWith("_ref"))).toHaveLength(0);
    });
  });
});

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
