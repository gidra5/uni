import { beforeEach, describe, expect, vi } from "vitest";
import { it, fc } from "@fast-check/vitest";
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

const testCase = (input: string, expected: unknown) => {
  const { bytecode, result } = runProgram(input);
  expect(bytecode).toMatchSnapshot();
  expect(result).toEqual(expected);
};

it.todo.prop([
  fc.string().map((program) => {
    const tokens = parseTokenGroups(program);
    const [, validatedTokens] = validateTokenGroups(tokens);
    return parseScript(validatedTokens);
  }),
])("script codegen never throws", (ast) => {
  try {
    generateVm2Bytecode(ast);
  } catch (e) {
    const msg = e instanceof Error ? e.stack : e;
    expect.unreachable(msg as string);
  }
});

it.todo.prop([
  fc.string().map((program) => {
    const tokens = parseTokenGroups(program);
    const [, validatedTokens] = validateTokenGroups(tokens);
    const ast = parseScript(validatedTokens);

    return generateVm2Bytecode(ast);
  }),
])("script execution never throws", (bytecode) => {
  try {
    const vm = new VM();
    for (const [name, code] of Object.entries(bytecode)) vm.addCode(name, code);
    vm.run();
  } catch (e) {
    const msg = e instanceof Error ? e.stack : e;
    expect.unreachable(msg as string);
  }
});

describe("advent of code 2023 day 1 single", () => {
  it.todo("variable", () =>
    testCase(
      `
        document := "
          1abc2
          pqr3stu8vwx
          a1b2c3d4e5f
          treb7uchet
        "
      `,
      `
          1abc2
          pqr3stu8vwx
          a1b2c3d4e5f
          treb7uchet
        `
    )
  );

  it.todo("split lines", () => {
    // const mutable = createSymbolMap({
    //   document: `
    //     1abc2
    //     pqr3stu8vwx
    //     a1b2c3d4e5f
    //     treb7uchet
    //   `,
    //   map: fn(2, (cs, list, fn) => {
    //     assert(Array.isArray(list));
    //     assert(typeof fn === "function");
    //     return Promise.all(
    //       list.map(async (x) => {
    //         const result = await fn(cs, x);
    //         assert(result !== null);
    //         return result;
    //       })
    //     );
    //   }),
    //   filter: fn(2, async (cs, list, fn) => {
    //     assert(Array.isArray(list));
    //     assert(typeof fn === "function");
    //     const result: EvalValue[] = [];
    //     for (const item of list) {
    //       const keep = await fn(cs, item);
    //       if (keep) result.push(item);
    //     }
    //     return result;
    //   }),
    // });
    const input = `
      mut lines := document.split("\\n")
      lines = map lines fn line: line.replace "\\\\s+" ""
      filter lines fn line -> line != ""
    `;
    const { bytecode, result } = runProgram(input);
    expect(bytecode).toMatchSnapshot();
    expect(result).toEqual(["1abc2", "pqr3stu8vwx", "a1b2c3d4e5f", "treb7uchet"]);
  });

  it.todo("parse numbers", () => {
    // const mutable = createSymbolMap({
    //   lines: ["1abc2", "pqr3stu8vwx", "a1b2c3d4e5f", "treb7uchet"],
    //   flat_map: fn(2, async (cs, list, fn) => {
    //     assert(Array.isArray(list));
    //     assert(typeof fn === "function");
    //     const mapped = await Promise.all(
    //       list.map(async (x) => {
    //         const result = await fn(cs, x);
    //         assert(result !== null);
    //         return result;
    //       })
    //     );
    //     return mapped.flat();
    //   }),
    // });
    const input = `
      numbers := flat_map lines fn mut line {
        digits := ()
        while line != "" {
          if line.char_at(0).match("\\\\d") {
            digit := number (line.char_at(0))
            if !(0 in digits): digits[0] = digit
            digits[1] = digit
          }
          line = line.slice(1,)
        }
        digits[0] * 10, digits[1]
      }
    `;
    const { bytecode, result } = runProgram(input);
    expect(bytecode).toMatchSnapshot();
    expect(result).toEqual([10, 2, 30, 8, 10, 5, 70, 7]);
  });

  it.todo("flat map list impl", () =>
    testCase(
      `
        flat_map := fn list, mapper {
          reduce list (fn acc, item -> (...acc, ...mapper item)) (fn first, second -> (...first, ...second)) ()
        }
      `,
      1
    )
  );

  it.todo("reduce list", () =>
    testCase(
      `
        import "std/concurrency" as { all }
        import "std/math" as { floor }

        reduce := fn list, reducer, merge, initial {
          if list.length == 0: return initial

          midpoint := floor(list.length / 2)
          item := list[midpoint]
          first, second := all(
            | (self (list.slice(0, midpoint)) reducer merge initial)
            | (self (list.slice(midpoint + 1,)) reducer merge initial)
          )

          merge (reducer first item) second
        };

        reduce (1, 2, 3, 4, 5) (fn acc, item -> acc + item) (fn first, second -> first + second) 0
      `,
      15
    )
  );

  it.todo("filter list impl", () =>
    testCase(
      `
        predicate := true
        first := ()
        item := 1
        acc := ()
        if predicate: (...first, item) else acc
      `,
      [1]
    )
  );

  describe("split list", () => {
    it.todo("5", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            {
              start--
              end--
              _, ...list = list
            }
              
            list, start, end
          } ((6,5,4,3,2,1), 4, 6)
         `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );

    it.todo("4", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            {
              start--
              end--
              _, ...list = list
            }
              
            list, start, end
          } ((6,5,4,3,2,1), 4)
         `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );

    it.todo("3", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            start--
            end--
            _, ...list = list
              
            list, start, end
          } ((6,5,4,3,2,1), 4)
         `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );

    it.todo("7", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            start--
            end--
              
            start, end
          } ((6,5,4,3,2,1), 4)
         `,
        [3, 5]
      )
    );

    it.todo("0", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            start--
            end--
            _, ...list = list
              
            list, start, end
          } ((6,5,4,3,2,1), 4, 6)
         `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );

    it.todo("2", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            while start != 0 {
              start--
              end--
              _, ...list = list
              break()
            }

            while end != list.length {
              ...list, _ = list
              break()
            }

            list, start, end
          } ((6,5,4,3,2,1), 4)
         `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );

    it.todo("6", () =>
      testCase(
        `
          fn (mut list, mut start = 0, mut end = (list.length)) {
            while start != 0 {
              start--
              end--
              _, ...list = list
              break()
            }

            while end != list.length {
              ...list, _ = list
              break()
            }

            list, start, end
          } ((6,5,4,3,2,1), 4, 6)
        `,
        [[5, 4, 3, 2, 1], 3, 5]
      )
    );
  });
});

describe("scope", () => {
  it.todo("block shadowing", () => testCase(`x := 1; { x := 2 }; x`, 1));
  it.todo("loop shadowing", () => testCase(`x := 1; loop { x := 2; break() }; x`, 1));

  it.todo("fn concurrent", () =>
    testCase(
      `
        import "std/concurrency" as { all }
        x := fn (a, b): a + b
        all(x(1, 2) | x(3, 4))
      `,
      [3, 7]
    )
  );

  it.todo("while block shadowing", () =>
    testCase(
      `
        number := 1

        while true {
          number := 5
          break()
        }

        number
      `,
      1
    )
  );

  it.todo("for block shadowing", () =>
    testCase(
      `
        number := 1;

        for x in 1, 2, 3 {
          number := 5;
          break()
        };

        number
      `,
      1
    )
  );

  it.todo("block assign", () => testCase(`mut n := 1; { n = 5 }; n`, 5));
  it.todo("block increment", () => testCase(`mut n := 1; { n += 5 }; n`, 6));

  it.todo("effect handlers inject scoping", () =>
    testCase(
      `
        x := 1;
        inject a: 1, b: 2 {
          x := 2;
        };
        x
      `,
      1
    )
  );

  it.todo("declaration shadowing and closures", () => testCase(`x := 1; f := fn: x; x := 2; f()`, 1));
  it.todo("and rhs creates scope", () => testCase(`x := 2; true and (x := 1); x`, 2));
  it.todo("or rhs creates scope", () => testCase(`x := 2; false or (x := 1); x`, 2));
  it.todo("is binds in local expression scope", () => testCase(`x := 2; 1 is x; x`, 2));
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
      it(name, () => testCase(program, expected));
    }
  });

  describe("arithmetics", () => {
    it("handles chained math with precedence", () => testCase("1 + 2^-3 * 4 - 5 / 6 % 7", 2 / 3));
  });

  describe("boolean expressions", () => {
    it("not on not boolean", () => testCase("!123", false));

    it("not on boolean", () => testCase("!true", false));

    it("and", () => testCase("true and false", false));

    it("and short-circuit", () => testCase("false and whatever", false));

    it("or", () => testCase("true or false", true));

    it("or short-circuit", () => testCase("true or whatever", true));

    it("in finds existing key", () => testCase("$key in (key: 1, key2: 2)", true));

    it.todo("in not finds not existing key", () => testCase("$key3 in (key: 1, key2: 2)", false));

    it.todo("in finds index holds value in tuple", () => testCase("1 in (1, 2)", true));

    it.todo("in finds index not holds value in tuple", () => testCase("5 in (1, 2)", false));

    it("eq", () => testCase("1 == 1", true));

    it("eq ref", () => testCase("x := 1, 2; y := x; x == y", true));

    it("eq ref 2", () => testCase("(1, 2) == (1, 2)", false));

    it("deep eq", () => testCase("(1, 2) === (1, 2)", true));

    it("compare", () => testCase("123 < 456", true));

    //     test.skip("range", () => {
    //       const src = `1 < 2 < 3`;
    //       evalTestCase(src);
    //     });

    //     test.skip("range fail", () => {
    //       const src = `1 < 3 < 2`;
    //       evalTestCase(src);
    //     });
  });

  describe("pattern matching", () => {
    it.todo("matches record pattern", () => testCase("record { a: 1, b: 2 } is { a, b }", true));

    it.todo("matches record pattern with rename", () => testCase("record { a: 1, b: 2} is { a: c, b }", true));

    it.todo("matches tuple pattern", () => testCase("(1, 2) is (a, b)", true));

    it.todo("matches rest pattern", () => testCase("(1, 2, 3) is (a, ...b)", true));

    it.todo("matches defaulted pattern", () => testCase("(2,) is (a, b = 4)", true));

    it("with 'is' operator", () => testCase("1 is x", true));

    it("with placeholder", () => testCase("1 is _", true));

    it("with constant value matches", () => testCase("1 is 1", true));

    it("with constant value does not match", () => testCase("1 is 2", false));
  });

  describe("function expressions", () => {
    it.todo("function with shadowed name access", () => testCase(`(fn a -> fn a -> #a) 1 2`, 1));

    it.todo("function with deep shadowed name access", () => testCase(`(fn a -> fn a -> fn a -> ##a) 1 2 3`, 1));

    it.todo("iife id", () => testCase(`(macro -> eval #0)()`, 1));

    it.todo("function with no arg", () => testCase(`(fn -> #0) 1`, 1));

    it.todo("fn no parameters", () => testCase("(fn -> 123) 0", 123));

    it("fn increment", () =>
      testCase(
        `
          line_handled_count := 0;
          inc := fn x {
            line_handled_count = line_handled_count + 1;
          };
          inc 0;
          line_handled_count
        `,
        1
      ));

    it.todo("fn increment 2", () =>
      testCase(
        `
          mut line_handled_count := 0
          inc := fn: line_handled_count++
          inc()
          line_handled_count
        `,
        1
      )
    );

    it("immediately invoked function expression (iife)", () => testCase("(fn x -> x) 1", 1));

    it("return from function", () => testCase("(fn x -> { return (x + 1); x }) 1", 2));

    it("function call multiple args", () => testCase("(fn x, y -> x + y) 1 2", 3));

    it("pipe", () => testCase("1 |> fn x { x + 1 } |> fn y { y * 2 }", 4));

    // TODO: translate into vm tests
    // it("function with named params from local scope expression", () => testCase(`%x + %y / %x`));
    // it.todo("function with unnamed params from local scope expression", () => testCase(`%1 + %2 / %1`));
    // it.todo("function with mixed params from local scope expression", () => testCase(`%1 + %x / %1`));
    // it.todo("methods chaining", () => testCase(`math.floor(1).pow(2)`));

    describe.todo("delimited application", () => {
      it("delimited args", () => testCase(`f:=fn x, y { x + y }; f(1, 2)`, 4));

      it("named args", () => testCase(`f:=fn x, y, z { x + y + z }; f(x: 1, 3, y: 2)`, 4));

      it("placeholder arg", () => testCase(`f:=fn x, y { x + y }; f(_, 1) 2`, 4));

      it("placeholder args", () => testCase(`f:=fn x, y, z { x + y + z }; f(_, 1, _) 2 3`, 4));

      it("spread args", () => testCase(`f:=fn x, y, z { x + y + z }; x:=1,2; f(3, ...x)`, 4));

      it("spread args 2", () => testCase(`f:=fn x, y, z { x + y + z }; x:=1,2; f(...x, 3)`, 4));
    });
  });

  describe("structured programming", () => {
    it("block returns last expression", () => testCase("{ 123 }", 123));
    it("empty block returns null", () => testCase("{}", null));
    it("label break returns value", () => testCase(`label::{ label.break 1; 2 }`, 1));

    it.todo("label loop if-then", () =>
      testCase(
        `
          mut x := 4 
          mut res := () 
          block::{
            if x <= 0 { res = ...res, x; block.break res }
            else {
              y := x--
              if y == 2 { res = ...res, 69; block.continue() }
              res = ...res, y
            }
            block.continue()
          }
        `,
        { tuple: [4, 3, 69, 1, 0] }
      )
    );

    it("label continue loops until break", () =>
      testCase(
        `
          mut x := 0;
          loop_label::{
            x = x + 1;
            if x < 3: loop_label.continue();
            loop_label.break x;
          }
        `,
        3
      ));

    it("if matches pattern and binds", () => testCase("if 1 is a: a + 1", 2));
    it("if with negated match falls back to else", () => testCase("if 1 is not a: 0 else a + 1", 2));
    it("if then expression", () => testCase("if true: 123", 123));
    it("if then else expression", () => testCase("if true: 123 else 456", 123));
    it("else if chain", () => testCase("if true: 123 else if false: 789 else 456", 123));

    it.todo("while loop increments until condition", () =>
      testCase(
        `
          mut x := 0;
          while x < 3 {
            x = x + 1;
          };
          x
        `,
        3
      )
    );

    it.todo("while loop continue", () =>
      testCase(
        `
          mut x := 0;
          mut y := ();
          while x < 3 {
            x++;
            if x == 1: continue();
            y = ...y, x
          };
          x, y
        `,
        { tuple: [3, { tuple: [2, 3] }] }
      )
    );

    // TODO: does it make sense?
    // it.todo("while loop break", () => testCase(`while true: break _`, null));

    it.todo("while loop break value", () => testCase(`while true: break 1`, 1));
    it.todo("while loop", () => testCase(`mut x := 0; while x < 10: x++; x`, 10));

    it("while loop with break returns value", () =>
      testCase(
        `
          mut x := 0;
          while x < 5 {
            x = x + 1;
            if x == 3: break x;
          }
        `,
        3
      ));

    it("while loop continue skips iteration", () =>
      testCase(
        `
          mut x := 0;
          mut count := 0;
          while x < 5 {
            x = x + 1;
            if x == 2: continue;
            count = count + 1;
          };
          count
        `,
        4
      ));

    it("loop break yields value", () => testCase("loop { break 42 }", 42));

    it("for loop", () => testCase("for n in (1, 2, 3): n", { tuple: [1, 2, 3] }));
    it("for loop maps values", () => testCase("for n in (1, 2, 3): n * 2", { tuple: [2, 4, 6] }));
    it.todo("for loop filter", () => testCase("for x in (1, 2, 3): if x > 1: x+1", { tuple: [3, 4] }));

    it("post increment returns old value and updates binding", () =>
      testCase("mut x := 0; y := x++; x, y", { tuple: [1, 0] }));

    it("sequencing returns last expression", () => testCase("123; 234; 345; 456", 456));

    it.todo("non-strict variable declaration with null", () => testCase(`{ like x := {} }`, null));
    it.todo("block variable declaration", () => testCase(`{ x := 123; x }`, 123));
    it.todo("block mutable variable declaration", () => testCase(`{ mut x := 123 }`, 123));
    it.todo("block variable assignment", () => testCase(`{ mut x := 123 }`, 123));

    it.todo("block variable assignment", () => testCase(`f := fn x { x() }; f { 123 }`, 123));

    it.todo("dynamic variable name", () => {
      testCase(`x := 1; [$x]`, 1);
      testCase(`[$x] := 1; [$x]`, 1);
      testCase(`[$x] := 1; x`, 1);
      testCase(`name := $x; [name] := 1; [name]`, 1);
      // testCase(`name := 2; [name] := 1; [name]`, 1);
      // testCase(`[2] := 1; [2]`, 1);
    });

    describe("error handling", () => {
      it.todo("try throw", () => testCase(`f := fn { throw 123 }; try f()`, { tuple: [{ atom: "error" }, 123] }));
      it.todo("try", () => testCase(`f := fn { 123 }; try f()`, { tuple: [{ atom: "ok" }, 123] }));
      it.todo("no try", () => testCase(`f := fn { throw 123 }; f()`, { effect: { kind: "throw", value: 123 } }));

      it.todo("? on ok result", () =>
        testCase(
          `
            f := fn { try 123 };
            g := fn { x := f()?; x + 1 };
            g()
          `,
          { tuple: [{ atom: "ok" }, 124] }
        )
      );

      it.todo("try unwrap ok result", () =>
        testCase(
          `
            f := fn { try 123 };
            g := fn { x := f()?; x + 1 };
            g().unwrap
          `,
          124
        )
      );

      it.todo("? on error result", () =>
        testCase(
          `
            f := fn { try throw 123 };
            g := fn { x := f()?; x + 1 };
            g()
          `,
          { tuple: [{ atom: "error" }, 123] }
        )
      );

      it.todo("try unwrap error result", () =>
        testCase(
          `
            f := fn { try throw 123 };
            g := fn { x := f()?; x + 1 };
            g().unwrap
          `,
          { effect: { kind: "throw", value: 123 } }
        )
      );

      it.todo("unwrap inside on ok result", () =>
        testCase(
          `
            f := fn { try 123 };
            g := fn { x := f().unwrap; x + 1 };
            g()
          `,
          124
        )
      );

      it.todo("unwrap inside on error result", () =>
        testCase(
          `
            f := fn { try throw 123 };
            g := fn { x := f().unwrap; x + 1 };
            g()
          `,
          { effect: { kind: "throw", value: 123 } }
        )
      );
    });

    describe("resource handling", () => {
      it.todo("rest", async () => {
        const input = `
          import "std/io" as io

          // file handle released at the end of script
          io.open "./file.txt" file ->
          file.write("hello")

          123
        `;
        const written: unknown[] = [];
        let closed = false;
        let opened = false;
        // TODO: mock handler
        const ioHandler = {};
        const handlers = { ioHandler };

        const result = runProgram(input, {
          /* handlers */
        });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });

      it.todo("block", async () => {
        const input = `
          import "std/io" as io

          // file closed at the end of block
          io.open "./file.txt" fn file {
            file.write("hello")
          }

          123
        `;
        const written: unknown[] = [];
        let closed = false;
        let opened = false;
        // TODO: mock handler
        const ioHandler = {};
        const handlers = { ioHandler };

        const result = runProgram(input, {
          /* handlers */
        });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });

      it.todo("do", async () => {
        const input = `
          import "std/io" as io

          // file closed at the end of statement
          io.open "./file.txt" fn file:
            file.write("hello")

          123
        `;
        const written: unknown[] = [];
        let closed = false;
        let opened = false;
        // TODO: mock handler
        const ioHandler = {};
        const handlers = { ioHandler };

        const result = runProgram(input, {
          /* handlers */
        });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });

      describe("dangling resources", () => {
        it.todo("through mutation", async () => {
          const input = `
            import "std/io" as { open };

            handle := ()

            // file closed at the end of block
            open "file.txt" fn file {
              file.write("hello")
              handle = file
            }

            handle.write("world") // error
          `;
          // TODO: check if error is thrown on second call
        });

        it.todo("through closure", async () => {
          const input = `
          import "std/io" as { open };

          // file closed at the end of block
          handle := open "file.txt" fn file {
            file.write("hello")

            fn: file.write("world")
          }

          handle() // error
        `;
          // TODO: check if error is thrown on second call
        });

        it.todo("through data", async () => {
          const input = `
            import "std/io" as { open };

            // file closed at the end of block
            status, handle := open "file.txt" fn file {
              file.write("hello")

              :done, file
            }

            handle.write("world") // error
          `;
          // TODO: check if error is thrown on second call
        });
      });
    });
  });

  describe("data structures", () => {
    it.todo("set literal", () => testCase("set(1, 2, 2).values()", { tuple: [1, 2] }));

    it.todo("field access", () => testCase("r := record { a: 1, b: 2 }; r.a", 1));
    it.todo("field access dynamic", () => testCase(`map := "some string": 1, b: 2; map["some string"]`, 1));

    it.todo("field assignment", () =>
      testCase(
        `
          mut x := record { a: 1, b: 2 };
          x.a = 3;
          x
        `,
        { record: { "atom:a": 3, "atom:b": 2 } }
      )
    );

    it.todo("unit literal", () => testCase("()", { tuple: [] }));

    it("tuple literal", () => testCase("(1, 2)", { tuple: [1, 2] }));

    it("record literal", () => testCase("a: 1, b: 2", { record: { "atom:a": 1, "atom:b": 2 } }));

    it("dictionary", () => testCase("[1]: 2, [3]: 4", { record: { "1": 2, "3": 4 } }));
    it.todo("dictionary without braces", () => testCase(`1+2: 3, 4+5: 6`, { record: { "3": 3, "9": 6 } }));
    it.todo("channel", () => testCase(`channel "name"`, { channel: "name" }));
  });

  // TODO: make tests actually run the program and check errors
  describe("null semantics", () => {
    it.todo("prints warning on evaluating to null anything", () => {
      const program = `x := {}`;
    });

    it.todo("no warning on evaluating to null when explicit", () => {
      const program = `void 1`;
    });

    it.todo("no warning on evaluating to null when explicit 2", () => {
      const program = `void {}`;
    });

    it.todo('error on evaluating to null when given "strict" vm flag', () => {
      const program = `void {}`;
    });
  });

  describe("lambda calculus constructs", () => {
    it("apply combinator", () => testCase("((fn f -> fn x -> f x) (fn y -> y)) 42", 42));

    it("either combinator applies first branch", () =>
      testCase("((fn x -> fn m -> fn n -> m x) 7) (fn v -> v + 1) (fn v -> v - 1)", 8));

    it("church pair returns first element", () =>
      testCase("((fn x -> fn y -> fn m -> m x y) 1 2) (fn a -> fn _ -> a)", 1));

    it("church pair returns second element", () =>
      testCase("((fn x -> fn y -> fn m -> m x y) 1 2) (fn _ -> fn b -> b)", 2));

    it("partial application keeps captured value", () => testCase("f := (fn x -> fn y -> x + y) 5; f 7", 12));

    it("deeply nested closures capture outer bindings", () =>
      testCase("adder := (fn x -> fn y -> fn z -> x + y + z) 1 3; adder 5", 9));

    it("fixed point combinator (Z) builds recursion", () =>
      testCase("(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v))) (fn self -> fn x -> x) 42", 42));

    it("Y combinator computes factorial", () =>
      testCase(
        [
          "(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)))",
          "(fn self -> fn n -> if n == 0: 1 else n * (self (n - 1)))",
          "5",
        ].join(" "),
        120
      ));

    it("Y combinator computes fibonacci", () =>
      testCase(
        [
          "(fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)))",
          "(fn self -> fn n -> if n == 0: 0 else if n == 1: 1 else self (n - 1) + self (n - 2))",
          "6",
        ].join(" "),
        8
      ));

    it("mutual recursion (even/odd) with fixed point combinator", () =>
      testCase(
        `
          Y := (fn f -> (fn x -> f (fn v -> x x v)) (fn x -> f (fn v -> x x v)));

          even := (Y (fn self -> fn n ->
            if n == 0: true else if n == 1: false else self (n - 2)
          ));
          odd := (Y (fn self -> fn n ->
            if n == 0: false else if n == 1: true else self (n - 2)
          ));

          (even 1, odd 1, even 2, odd 2)
        `,
        { tuple: [false, true, true, false] }
      ));
  });

  describe("symbols", () => {
    it("creates a named symbol", () => {
      const { bytecode, result } = runProgram('symbol "foo"');
      expect(bytecode).toMatchSnapshot();
      expect(result).toMatchObject({ name: "foo", symbol: expect.any(Number) });
    });

    it("atoms equality is by name", () => {
      const { bytecode, result: atomResult } = runProgram("$a == $a");
      expect(bytecode).toMatchSnapshot();
      expect(atomResult).toBe(true);
    });

    it("symbol equality is by identity", () => {
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

  describe("concurrent programming", () => {
    it.todo("parallel all", () =>
      testCase(
        `
        import "std/concurrency" as { all };
        all(1 | 2)
      `,
        { tuple: [1, 2] }
      )
    );

    it.todo("channel send receive", () => testCase('c := channel "test"; async c <- 123; <- c', 123));

    it.todo("await async", () => testCase("f := fn x: x + 1; await async f 1", 2));

    it.todo("select channels", () =>
      testCase(
        `
        c1 := channel "c1"; 
        c2 := channel "c2"; 
        async c1 <- 123; 
        async c2 <- 456; 
        <- c2 + c1
      `,
        123
      )
    );
  });

  describe("effect handlers", () => {
    it.todo("all in one", () =>
      testCase(
        `
          inject a: 1, b: 2 {
            a := handle ($a) ()
            b := handle ($b) ()
            inject a: a+1, b: b+2 {
              mask $a ->
              without $b ->

              a := handle ($a) ()
              a + 1
            }
          }
        `,
        2
      )
    );

    it.todo("inject", () =>
      testCase(
        `
          inject a: 1, b: 2 ->
          handle ($a) (), handle ($b) ()
        `,
        { tuple: [1, 2] }
      )
    );

    it.todo("mask", () =>
      testCase(
        `
          inject a: 1, b: 2 ->
          a := handle ($a) ()
          b := handle ($b) ()
          
          inject a: a+1, b: b+2 ->
          mask $a ->
          a := handle ($a) ()
          b := handle ($b) ()
          a, b
        `,
        { tuple: [1, 4] }
      )
    );

    it.todo("mask 2", () =>
      testCase(
        `
        inject record { a: 1, b: 2 } ->
        mask $a ->
        handle ($a) (), handle ($b) ()
      `,
        { tuple: [1, 2] }
      )
    );

    it.todo("without", () =>
      testCase(
        `
          inject a: 1 ->
          without $a ->
          ($a |> handle) ()
        `,
        { effect: { kind: "throw", value: "no handler" } }
      )
    );

    it.todo("inject shadowing", () =>
      testCase(
        `
          inject a: 1, b: 2 ->
          a := handle ($a) ()
          b := handle ($b) ()
            
          inject a: a+1, b: b+2 ->

          handle ($a) (),
          handle ($b) ()
        `,
        { tuple: [2, 4] }
      )
    );

    it.todo("parallel inside", () =>
      testCase(
        `
          f := fn {
            a := handle ($a) ()
            b := handle ($b) ()
            a + b
          }
          
          inject a: 1, b: 2 ->
          x1 := f()
          x2 := async { inject a: 3      : f() }
          x3 := async { inject a: 5, b: 4: f() }
          x1, await x2, await x3
        `,
        { tuple: [3, 5, 9] }
      )
    );

    it.todo("handler with continuation", () =>
      testCase(
        `
        decide := $decide |> handle
        _handler := record {
          decide: handler fn (callback, value) {
            x1 := callback true
            x2 := callback false
            x1, x2
          }
        }

        inject _handler ->
        if decide(): 123 else 456
      `,
        { tuple: [123, 456] }
      )
    );
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

describe("modules", () => {
  describe("import", () => {
    it.todo("import declaration");
    it.todo("import project absolute");
    it.todo("import project relative");
    it.todo("import project root");
    it.todo("import project file");
    it.todo("import with external");
    it.todo("import script");
    it.todo("import interop with other language");
    it.todo("dynamic import");
    it.todo("modules import as singletons");
  });

  describe("declarations", () => {
    it.todo("private declaration");
    it.todo("export declaration");
    it.todo("export default");
    it.todo("external declaration");
    it.todo("namespace");
  });

  describe("traits", () => {
    it.todo("declaration");
    it.todo("declaration with selector");
    it.todo("implementation");
    it.todo("implementation with default");
  });

  describe("annotations", () => {
    it.todo("declaration");
    it.todo("implementation");
    it.todo("implementation with default");
  });

  describe("types", () => {
    it.todo("declaration");
    it.todo("usage");
  });

  describe("functions", () => {
    it.todo("declaration");
    it.todo("usage");
    it.todo("indirect recursion");
  });

  describe("variables", () => {
    it.todo("variable declaration");
    it.todo("constant declaration");
  });

  describe("compile-time", () => {
    it.todo("compile-time expression");
  });

  describe("reflection", () => {
    it.todo("reflection");
  });

  describe("classes", () => {
    it.todo("class declaration");
    it.todo("class usage");
    it.todo("class method");
    it.todo("class field");
    it.todo("class static field");
    it.todo("class static method");
    it.todo("class constructor");
  });

  describe("actors", () => {
    it.todo("actor declaration");
    it.todo("actor usage");
    it.todo("actor method");
    it.todo("actor field");
    it.todo("actor static field");
    it.todo("actor static method");
    it.todo("actor constructor");
  });

  describe("operator declarations", () => {
    it.todo("operator declaration");
  });
});

describe("reactivity", () => {
  it.todo("reactive declaration");
});
