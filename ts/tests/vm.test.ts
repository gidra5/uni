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
  const vm = new VM(options);
  for (const [name, code] of Object.entries(bytecode)) vm.addCode(name, code);
  const result = vm.run();
  return { bytecode, result, vm };
};

describe("scope", () => {
  it.todo("and rhs creates scope", async () => {
    const input = `
        x := 2;
        true and (x := 1);
        x
      `;
    const { bytecode, result } = runProgram(input);
    expect(bytecode).toMatchSnapshot();
    expect(result).toBe(2);
  });

  it.todo("or rhs creates scope", async () => {
    const input = `
        x := 2;
        false or (x := 1);
        x
      `;
    const { bytecode, result } = runProgram(input);
    expect(bytecode).toMatchSnapshot();
    expect(result).toBe(2);
  });

  it.todo("is binds in local expression scope", async () => {
    const input = `
        x := 2;
        1 is x;
        x
      `;
    const { bytecode, result } = runProgram(input);
    expect(bytecode).toMatchSnapshot();
    expect(result).toBe(2);
  });
});

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
      expect(result).toBeCloseTo(2 / 3);
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

    it("in finds existing key", () => {
      const { bytecode, result } = runProgram("$key in (key: 1, key2: 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it.todo("in not finds not existing key", async () => {
      const { bytecode, result } = runProgram("$key3 in (key: 1, key2: 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
    });

    it.todo("in finds index holds value in tuple", async () => {
      const { bytecode, result } = runProgram("1 in (1, 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(true);
    });

    it.todo("in finds index not holds value in tuple", async () => {
      const { bytecode, result } = runProgram("5 in (1, 2)");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(false);
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

    //     test.skip("range", () => {
    //       const src = `1 < 2 < 3`;
    //       evalTestCase(src);
    //     });

    //     test.skip("range fail", () => {
    //       const src = `1 < 3 < 2`;
    //       evalTestCase(src);
    //     });
  });

  // TODO: translate these tests into vm tests
  // describe("function expressions", () => {
  //   it("function block body", () => testCase(`fn x, y { x + y }`));
  //   it("function multiple params", () => testCase(`fn x, y -> x + y`));
  //   it("fn no parameters", () => testCase(`fn -> 123`));
  //   it("fn no parameters block", () => testCase(`fn { 123 }`));
  //   it("arrow function", () => testCase(`x -> x`));
  //   it("arrow function with parameter type", () => testCase(`x: number -> x`));
  //   it("fn increment", () => testCase(`fn -> line_handled_count++`));
  //   it("function with return type", () => testCase(`fn x, y -> number { x + y }`));
  //   it("function with parameter types", () => testCase(`fn (x: number, y: string) -> number { x + y }`));
  //   it("named function", () => testCase(`fn sum(x: number, y: number) -> number { x + y }`));
  //   it("function with placeholder arg", () => testCase(`_ -> #0`));
  //   it("function with no arg", () => testCase(`fn -> #0`));
  //   it("function with shadowed name access", () => testCase(`fn a -> fn a -> #a`));
  //   it("function with deep shadowed name access", () => testCase(`fn a -> fn a -> fn a -> ##a`));
  //   it("function with deep shadowed name access", () => testCase(`fn a -> fn a -> fn a -> ##a`));
  //   it("function with named params from local scope expression", () => testCase(`%x + %y / %x`));
  //   it.todo("function with unnamed params from local scope expression", () => testCase(`%1 + %2 / %1`));
  //   it.todo("function with mixed params from local scope expression", () => testCase(`%1 + %x / %1`));

  //   describe("application", () => {
  //     it("function call", () => testCase(`f x`));
  //     it("function call multiple args", () => testCase(`f x y`));
  //     it("function call param with field", () => testCase(`f x.y`));
  //     it("send((1+2), 3)", () => testCase(`send((1+2), 3)`));
  //     it("send(2, 3)", () => testCase(`send(2, 3)`));
  //     it("(send)(2, 3)", () => testCase(`(send)(2, 3)`));
  //     it("(send 1)(2, 3)", () => testCase(`(send 1)(2, 3)`));
  //     it("(send 1 2)(2, 3)", () => testCase(`(send 1 2)(2, 3)`));
  //     it("send 1 + 2", () => testCase(`send 1 + 2`));
  //     it("a + send (2, 3)", () => testCase(`a + send (2, 3)`));
  //     it("send a (2, 3)", () => testCase(`send a (2, 3)`));
  //     it("send 1 (2, 3)", () => testCase(`send 1 (2, 3)`));
  //     it("a + send 1 + 2", () => testCase(`a + send 1 + 2`));
  //     it("methods chaining", () => testCase(`math.floor(1).multiply(2)`));
  //     it("function as last arg", () => testCase(`open "file" file -> write file "yolo"`));
  //     it("block as last arg", () => testCase(`open "file" { write "yolo" }`));
  //     it("pipe", () => testCase(`1 |> fn x { x + 1 } |> fn y { y * 2 }`));
  //   });

  //   describe("delimited application", () => {
  //     it("delimited args", () => testCase(`f(x, y)`));
  //     it("named args", () => testCase(`f(x: 1, 3, y: 2)`));
  //     it("placeholder arg", () => testCase(`f(_, y)`));
  //     it("placeholder args", () => testCase(`f(_, y, _)`));
  //     it("spread args", () => testCase(`f(...x, y)`));
  //   });

  //   describe("function forms", () => {
  //     it("immediate form", () => testCase(`fn: x; y`));
  //     it("block form", () => testCase(`fn { x }`));
  //     it("rest form", () => testCase(`fn -> x; y`));
  //   });
  // });
  /* 
  
    describe("function expressions", () => {
      it("fn increment", async () => {
        const input = `
          mut line_handled_count := 0
          inc := fn do line_handled_count++
          inc()
          line_handled_count
        `;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
  
      it("immediately invoked function expression (iife)", async () => {
        const input = `(fn x -> x) 1`;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
  
      it("return from function", async () => {
        const input = `(fn x -> { return (x + 1); x }) 1`;
        const result = await evaluate(input);
        expect(result).toBe(2);
      });
  
      it("function call multiple args", async () => {
        const input = `(fn x, y -> x + y) 1 2`;
        const result = await evaluate(input);
        expect(result).toBe(3);
      });
  
      it("pipe", async () => {
        const input = `1 |> fn x { x + 1 } |> fn y { y * 2 }`;
        const result = await evaluate(input);
        expect(result).toBe(4);
      });
  
      it.todo("function with shadowed name access", async () => {
        const input = `(fn a -> fn a -> #a) 1 2`;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
  
      it.todo("function with deep shadowed name access", async () => {
        const input = `(fn a -> fn a -> fn a -> ##a) 1 2 3`;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
  
      it.todo("iife id", async() => {
        const input = `(macro -> eval #0)()`;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
  
      it.todo("function with no arg", async () => {
        const input = `(fn -> #0) 1`;
        const result = await evaluate(input);
        expect(result).toBe(1);
      });
    });
  */

  describe("function expressions", () => {
    it.todo("fn no parameters", () => {
      const { bytecode, result } = runProgram("(fn -> 123) 0");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(123);
    });

    it("fn increment", () => {
      const program = `
        line_handled_count := 0;
        inc := fn x {
          line_handled_count = line_handled_count + 1;
        };
        inc 0;
        line_handled_count
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(1);
    });

    it("immediately invoked function expression (iife)", () => {
      const { bytecode, result } = runProgram("(fn x -> x) 1");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(1);
    });

    it("return from function", () => {
      const { bytecode, result } = runProgram("(fn x -> { return (x + 1); x }) 1");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(2);
    });

    it("function call multiple args", () => {
      const { bytecode, result } = runProgram("(fn x, y -> x + y) 1 2");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(3);
    });

    it("pipe", () => {
      const { bytecode, result } = runProgram("1 |> fn x { x + 1 } |> fn y { y * 2 }");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(4);
    });
  });

  describe("structured programming", () => {
    it("block returns last expression", () => {
      const { bytecode, result } = runProgram("{ 123 }");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(123);
    });

    it("empty block returns null", () => {
      const { bytecode, result } = runProgram("{}");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBeNull();
    });

    it("label break returns value", () => {
      const program = `
        label::{
          label.break 1;
          2
        }
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(1);
    });

    it("label continue loops until break", () => {
      const program = `
        mut x := 0;
        loop_label::{
          x = x + 1;
          if x < 3: loop_label.continue();
          loop_label.break x;
        }
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(3);
    });

    it("if matches pattern and binds", () => {
      const { bytecode, result } = runProgram("if 1 is a: a + 1");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(2);
    });

    it("if with negated match falls back to else", () => {
      const { bytecode, result } = runProgram("if 1 is not a: 0 else a + 1");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(2);
    });

    it("if then expression", () => {
      const { bytecode, result } = runProgram("if true: 123");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(123);
    });

    it("if then else expression", () => {
      const { bytecode, result } = runProgram("if true: 123 else 456");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(123);
    });

    it("else if chain", () => {
      const { bytecode, result } = runProgram("if true: 123 else if false: 789 else 456");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(123);
    });

    it("while loop with break returns value", () => {
      const program = `
        mut x := 0;
        while x < 5 {
          x = x + 1;
          if x == 3: break x;
        }
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(3);
    });

    it("while loop continue skips iteration", () => {
      const program = `
        mut x := 0;
        mut count := 0;
        while x < 5 {
          x = x + 1;
          if x == 2: continue;
          count = count + 1;
        };
        count
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(4);
    });

    it("loop break yields value", () => {
      const { bytecode, result } = runProgram("loop { break 42 }");
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(42);
    });

    it("for loop maps values", () => {
      const { bytecode, result } = runProgram("for n in (1, 2, 3): n * 2");
      expect(bytecode).toMatchSnapshot();
      expect(result).toEqual({ tuple: [2, 4, 6] });
    });

    it("post increment returns old value and updates binding", () => {
      const { bytecode, result } = runProgram("mut x := 0; y := x++; x, y");
      expect(bytecode).toMatchSnapshot();
      expect(result).toEqual({ tuple: [1, 0] });
    });
  });

  describe("lambda calculus constructs", () => {
    it("apply combinator", () => {
      const program = "((fn f -> fn x -> f x) (fn y -> y)) 42";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(42);
    });

    it("either combinator applies first branch", () => {
      const program = "((fn x -> fn m -> fn n -> m x) 7) (fn v -> v + 1) (fn v -> v - 1)";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(8);
    });

    it("church pair returns first element", () => {
      const program = "((fn x -> fn y -> fn m -> m x y) 1 2) (fn a -> fn _ -> a)";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(1);
    });

    it("church pair returns second element", () => {
      const program = "((fn x -> fn y -> fn m -> m x y) 1 2) (fn _ -> fn b -> b)";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(2);
    });

    it("partial application keeps captured value", () => {
      const program = "f := (fn x -> fn y -> x + y) 5; f 7";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(12);
    });

    it("deeply nested closures capture outer bindings", () => {
      const program = "adder := (fn x -> fn y -> fn z -> x + y + z) 1 3; adder 5";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(9);
    });

    it("fixed point combinator (Z) builds recursion", () => {
      const program = "(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v))) (fn self -> fn x -> x) 42";
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(42);
    });

    it("Y combinator computes factorial", () => {
      const program = [
        "(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)))",
        "(fn self -> fn n -> if n == 0: 1 else n * (self (n - 1)))",
        "5",
      ].join(" ");
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(120);
    });

    it("Y combinator computes fibonacci", () => {
      const program = [
        "(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)))",
        "(fn self -> fn n -> if n == 0: 0 else if n == 1: 1 else self (n - 1) + self (n - 2))",
        "6",
      ].join(" ");
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toBe(8);
    });

    it("mutual recursion (even/odd) with fixed point combinator", () => {
      const program = `
        Y := (fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)));

        even := (Y (fn self -> fn n ->
          if n == 0: true else if n == 1: false else self (n - 2)
        ));
        odd := (Y (fn self -> fn n ->
          if n == 0: false else if n == 1: true else self (n - 2)
        ));

        (even 1, odd 1, even 2, odd 2)
      `;
      const { bytecode, result } = runProgram(program);
      expect(bytecode).toMatchSnapshot();
      expect(result).toEqual({ tuple: [false, true, true, false] });
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
    const vm = new VM({ natives: { print: (_vm, [value]) => console.log(value) } });
    for (const [name, code] of Object.entries(bytecode)) vm.addCode(name, code);
    const result = vm.run();

    expect(result).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(3);
    logSpy.mockRestore();
  });
});
