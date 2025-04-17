// import { describe, expect } from "vitest";
// import { it, fc, test } from "@fast-check/vitest";
// import { Iterator } from "iterator-js";
// import { infixArithmeticOps, prefixArithmeticOps } from "../src/parser/constants";
// import { parseExprString } from "../src/parser/string";
// import { parseTokens } from "../src/parser/tokens";
// import { parse } from "../src/parser";
// import { omitASTDataScope } from "../src/utils";
// import { evaluate } from "../src/evaluation";
// import { TaskQueue } from "../src/evaluation/taskQueue";
// import { transform } from "../src/transformers/desugar";

// export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
//   _it(`finds all errors in example '${src}'`, () => {
//     const [, errors] = parseExprString(src);
//     expect(errors).toEqual(expectedErrors);
//   });

// export const evalTestCase = (src, expectedValue?, expectedTree?) => {
//   const [tokens] = parseTokens(src);
//   const [tree, errors] = parse()(tokens);
//   // console.dir(tree, { depth: null });
//   expect(errors).toEqual([]);
//   const _tree = omitASTDataScope(tree);
//   if (expectedTree) expect(_tree).toEqual(expectedTree);
//   expect(_tree).toMatchSnapshot();

//   const taskQueue = new TaskQueue();
//   const resultSymbol = evaluate(taskQueue, transform(_tree));
//   taskQueue.run();
//   const result = taskQueue.receive(resultSymbol);
//   if (expectedValue) expect(result).toEqual(expectedValue);
//   expect(result).toMatchSnapshot();
// };

// export const evalTestCaseArgs = (src, expectedValue?) =>
//   [`produces correct value for '${src}'`, () => evalTestCase(src, expectedValue)] as const;

// /* one test per example of a language construct  */

// describe("comments", () => {
//   it("comment", async () => {
//     const input = `// comment\n123`;
//     const result = await evaluate(input);
//     expect(result).toBe(123);
//   });

//   it("comment block", async () => {
//     const input = `/* comment block */123`;
//     const result = await evaluate(input);
//     expect(result).toBe(123);
//   });
// });

// describe("expressions", () => {
//   describe("values", () => {
//     test("integer", () => {
//       const src = `123`;
//       evalTestCase(src);
//     });

//     test("float", () => {
//       const src = `123.456`;
//       evalTestCase(src);
//     });

//     test("string", () => {
//       const src = `"string"`;
//       evalTestCase(src);
//     });

//     test("true", () => {
//       const src = `true`;
//       evalTestCase(src);
//     });

//     test("false", () => {
//       const src = `false`;
//       evalTestCase(src);
//     });
//   });

//   describe("arithmetics", () => {
//     it(...evalTestCaseArgs("1 + 2^-3 * 4 - 5 / 6 % 7"));
//   });

//   describe("boolean expressions", () => {
//     test("not on not boolean", () => {
//       const src = `!123`;
//       evalTestCase(src);
//     });

//     test("not on boolean", () => {
//       const src = `!true`;
//       evalTestCase(src);
//     });

//     test("and", () => {
//       const src = `true and false`;
//       evalTestCase(src);
//     });

//     test("and short-circuit", () => {
//       const src = `false and whatever`;
//       evalTestCase(src);
//     });

//     test("or", () => {
//       const src = `true or false`;
//       evalTestCase(src);
//     });

//     test("or short-circuit", () => {
//       const src = `true or whatever`;
//       evalTestCase(src);
//     });

//     test("in", () => {
//       const src = `:key in (key: 1, key2: 2)`;
//       evalTestCase(src);
//     });

//     test("eq", () => {
//       const src = `1 == 1`;
//       evalTestCase(src);
//     });

//     test("eq ref", () => {
//       const src = `x := 1, 2; y := x; x == y`;
//       evalTestCase(src);
//     });

//     test("eq ref 2", () => {
//       const src = `(1, 2) == (1, 2)`;
//       evalTestCase(src);
//     });

//     test("deep eq", () => {
//       const src = `(1, 2) === (1, 2)`;
//       evalTestCase(src);
//     });

//     test("compare", () => {
//       const src = `123 < 456`;
//       evalTestCase(src);
//     });

//     test.skip("range", () => {
//       const src = `1 < 2 < 3`;
//       evalTestCase(src);
//     });

//     test.skip("range fail", () => {
//       const src = `1 < 3 < 2`;
//       evalTestCase(src);
//     });
//   });

//   describe("function expressions", () => {
//     test("iife id", () => {
//       const src = `(macro -> eval #0)()`;
//       evalTestCase(src);
//     });
//     test("function with no arg", () => {
//       const src = `fn -> #0`;
//       evalTestCase(src);
//     });

//     test("immediately invoked function expression (iife)", () => {
//       const src = `(fn x -> x) 1`;
//       evalTestCase(src, 1);
//     });

//     test("return from function", () => {
//       const src = `(fn x -> { return (x + 1); x }) 1`;
//       evalTestCase(src, 2);
//     });

//     test.todo("function with shadowed name access", () => {
//       const src = `fn a -> fn a -> #a`;
//       evalTestCase(src);
//     });

//     test.todo("function with deep shadowed name access", () => {
//       const src = `fn a -> fn a -> fn a -> ##a`;
//       evalTestCase(src);
//     });

//     describe.todo("application", () => {
//       test("function call", () => {
//         const src = `f x`;
//         evalTestCase(src);
//       });

//       test("function call multiple args", () => {
//         const src = `f x y`;
//         evalTestCase(src);
//       });
//     });
//   });

//   describe.todo("pattern matching", () => {
//     test("match", () => {
//       const src = `match x { 1 -> 2; 3 -> 4 }`;
//       evalTestCase(src);
//     });

//     test("match that accepts tuple", () => {
//       const src = `match x: ((1 -> 2), (3 -> 4))`;
//       evalTestCase(src);
//     });

//     test("in function parameters", () => {
//       const src = `(x, y) -> x + y`;
//       evalTestCase(src);
//     });

//     describe("set-theoretic patterns", () => {
//       test("pattern union", () => {
//         const src = `((x:x, y:y) or (y:y, z:z)) -> y`;
//         evalTestCase(src);
//       });

//       test("pattern intersection", () => {
//         const src = `((x:x, y:y) and (z:z)) -> x + y + z`;
//         evalTestCase(src);
//       });

//       test("pattern negation", () => {
//         const src = `(!(x:x, y:y)) -> x + y + z`;
//         evalTestCase(src);
//       });
//     });

//     test("with 'is' operator", () => {
//       const src = `x is (a, b)`;
//       evalTestCase(src);
//     });

//     test("with placeholder", () => {
//       const src = `x is (_, b)`;
//       evalTestCase(src);
//     });

//     test("with variable value", () => {
//       const src = `x is (^a, b)`;
//       evalTestCase(src);
//     });

//     test("with rest value", () => {
//       const src = `x is (a, ...b)`;
//       evalTestCase(src);
//     });

//     test("with rest value first", () => {
//       const src = `x is (...b, a)`;
//       evalTestCase(src);
//     });

//     test("with default value", () => {
//       const src = `x is ((b = 4), a)`;
//       evalTestCase(src);
//     });

//     test("with rename", () => {
//       const src = `x is (a @ b, c)`;
//       evalTestCase(src);
//     });

//     test("with name for match", () => {
//       const src = `x is ((a, b) @ c)`;
//       evalTestCase(src);
//     });

//     test.todo("with type", () => {
//       const src = `x is (b as number, a)`;
//       evalTestCase(src);
//     });

//     test("binding visible in scope where it is true", () => {
//       const src = `x is (a, b) and a == b + 1`;
//       evalTestCase(src);
//     });
//   });

//   describe.todo("structured programming", () => {
//     test("label", () => {
//       const src = `x:=label::((label 1),2)`;
//       evalTestCase(src);
//     });
//     test("if-then", () => {
//       const src = `y := (
//         x := 25
//         res := ()
//         loop::{
//           if x <= 0: (res = ...res, x; loop.break)
//           else {
//             y := x
//             x = x - 1
//             if y == 19: (res = ...res, 69; loop.continue)
//             res = ...res, y
//           }
//         }
//         res
//       )`;
//       evalTestCase(src);
//     });

//     test("if-then", () => {
//       const src = `if true: 123`;
//       evalTestCase(src);
//     });

//     test("if-then newline", () => {
//       const src = `if true\n 123`;
//       evalTestCase(src);
//     });

//     test("if-then-else", () => {
//       const src = `if true: 123 else 456`;
//       evalTestCase(src);
//     });

//     test("if-then-elseif-then-else", () => {
//       const src = `if true: 123 else if false: 789 else 456`;
//       evalTestCase(src);
//     });

//     test("if-then newline-else", () => {
//       const src = `if true\n 123 else 456`;
//       evalTestCase(src);
//     });

//     test("if-then newline-else newline", () => {
//       const src = `if true\n 123 else\n 456`;
//       evalTestCase(src);
//     });

//     test("block", () => {
//       const src = `{ 123 }`;
//       evalTestCase(src);
//     });

//     test("for loop", () => {
//       const src = `for x in [1, 2, 3]: x`;
//       evalTestCase(src);
//     });

//     test("for loop newline", () => {
//       const src = `for x in [1, 2, 3]\n x`;
//       evalTestCase(src);
//     });

//     test("while loop", () => {
//       const src = `while true: 123`;
//       evalTestCase(src);
//     });

//     test("while loop break", () => {
//       const src = `while true: break _`;
//       evalTestCase(src);
//     });

//     test("while loop break value", () => {
//       const src = `while true: break 1`;
//       evalTestCase(src);
//     });

//     test("while loop continue", () => {
//       const src = `while true: continue _`;
//       evalTestCase(src);
//     });

//     test("while loop continue value", () => {
//       const src = `while true: continue 1`;
//       evalTestCase(src);
//     });

//     test("labeled expression", () => {
//       const src = `label: 123`;
//       evalTestCase(src);
//     });

//     test("return", () => {
//       const src = `() -> { return 123 }`;
//       evalTestCase(src);
//     });

//     test("block variable declaration", () => {
//       const src = `{ x := 123 }`;
//       evalTestCase(src);
//     });

//     test("block mutable variable declaration", () => {
//       const src = `{ mut x := 123 }`;
//       evalTestCase(src);
//     });

//     test("block variable assignment", () => {
//       const src = `{ x = 123 }`;
//       evalTestCase(src);
//     });

//     test("block pattern matching", () => {
//       const src = `{ x, y = 123, 456 }`;
//       evalTestCase(src);
//     });
//   });

//   describe.todo("concurrent programming", () => {
//     test("channel send", () => {
//       const src = `c <- 123`;
//       evalTestCase(src);
//     });

//     test("channel receive", () => {
//       const src = `<- c`;
//       evalTestCase(src);
//     });

//     test("parallel value", () => {
//       const src = `123 | 456`;
//       evalTestCase(src);
//     });

//     test("parallel with channels", () => {
//       const src = `c <- 123 | <- c`;
//       evalTestCase(src);
//     });

//     test("async", () => {
//       const src = `async f x`;
//       evalTestCase(src);
//     });

//     test("await async", () => {
//       const src = `await async f x`;
//       evalTestCase(src);
//     });

//     test("await", () => {
//       const src = `await x + 1`;
//       evalTestCase(src);
//     });

//     test("yield", () => {
//       const src = `yield 123`;
//       evalTestCase(src);
//     });
//   });

//   describe.todo("data structures", () => {
//     test("unit", () => {
//       const src = `()`;
//       evalTestCase(src);
//     });

//     test("symbol", () => {
//       const src = `symbol`;
//       evalTestCase(src);
//     });

//     test("channel", () => {
//       const src = `channel`;
//       evalTestCase(src);
//     });

//     test("atom (global symbol)", () => {
//       const src = `:atom`;
//       evalTestCase(src);
//     });

//     test("tuple", () => {
//       const src = `1, 2`;
//       evalTestCase(src);
//     });

//     test("record", () => {
//       const src = `a: 1, b: 2`;
//       evalTestCase(src);
//     });

//     test("set", () => {
//       const src = `set (1, 2)`;
//       evalTestCase(src);
//     });

//     test("map", () => {
//       const src = `[1]: 2, [3]: 4`;
//       evalTestCase(src);
//     });

//     test("map without braces", () => {
//       const src = `1+2: 3, 4+5: 6`;
//       evalTestCase(src);
//     });

//     test("field access static", () => {
//       const src = `x.y`;
//       evalTestCase(src);
//     });

//     test("field access dynamic", () => {
//       const src = `x[y]`;
//       evalTestCase(src);
//     });
//   });

//   describe.todo("types", () => {
//     describe("primitives", () => {
//       test("number", () => {
//         const src = `number`;
//         evalTestCase(src);
//       });

//       test("int", () => {
//         const src = `int`;
//         evalTestCase(src);
//       });

//       test("float", () => {
//         const src = `float`;
//         evalTestCase(src);
//       });

//       test("string", () => {
//         const src = `string`;
//         evalTestCase(src);
//       });

//       test("char", () => {
//         const src = `char`;
//         evalTestCase(src);
//       });

//       test("boolean", () => {
//         const src = `boolean`;
//         evalTestCase(src);
//       });

//       test("unit", () => {
//         const src = `unit`;
//         evalTestCase(src);
//       });

//       test("unknown", () => {
//         const src = `unknown`;
//         evalTestCase(src);
//       });

//       test("void", () => {
//         const src = `void`;
//         evalTestCase(src);
//       });

//       test("type", () => {
//         const src = `type`;
//         evalTestCase(src);
//       });

//       test("type with order", () => {
//         const src = `type[1]`;
//         evalTestCase(src);
//       });

//       test("value type", () => {
//         const src = `value 1`;
//         evalTestCase(src);
//       });
//     });

//     describe("algebraic types", () => {
//       test("record", () => {
//         const src = `(a: number; b: string)`;
//         evalTestCase(src);
//       });

//       test("map", () => {
//         const src = `([number]: string)`;
//         evalTestCase(src);
//       });

//       test("map with key dependency", () => {
//         const src = `([x: number]: (x, string))`;
//         evalTestCase(src);
//       });

//       test("tuple", () => {
//         const src = `number, string`;
//         evalTestCase(src);
//       });

//       test("type key access", () => {
//         const src = `type[number]`;
//         evalTestCase(src);
//       });

//       test("type key access static", () => {
//         const src = `type.key`;
//         evalTestCase(src);
//       });

//       test("discriminated union from record type", () => {
//         const src = `enum (a: number; b: string)`;
//         evalTestCase(src);
//       });

//       test("discriminated by order union from tuple", () => {
//         const src = `enum (number, string)`;
//         evalTestCase(src);
//       });
//     });

//     describe("set-theoretic types", () => {
//       test("negated type", () => {
//         const src = `!number`;
//         evalTestCase(src);
//       });

//       test("type intersection", () => {
//         const src = `number and string`;
//         evalTestCase(src);
//       });

//       test("type union", () => {
//         const src = `number or string`;
//         evalTestCase(src);
//       });
//     });

//     describe("functions", () => {
//       test("function type", () => {
//         const src = `number -> string`;
//         evalTestCase(src);
//       });

//       test("function type with multiple args", () => {
//         const src = `fn number, string -> string`;
//         evalTestCase(src);
//       });

//       test("function type with named args", () => {
//         const src = `fn x: number, y: string -> string`;
//         evalTestCase(src);
//       });

//       test("dependent function type", () => {
//         const src = `fn x: boolean -> if x: string else number`;
//         evalTestCase(src);
//       });

//       test("parametric function type", () => {
//         const src = `fn x: infer y -> y or number`;
//         evalTestCase(src);
//       });

//       test("higher order type", () => {
//         const src = `fn t: type -> fn x: t -> t or number`;
//         evalTestCase(src);
//       });
//     });

//     test("typeof", () => {
//       const src = `typeof x`;
//       evalTestCase(src);
//     });

//     test("type cast", () => {
//       const src = `x as number`;
//       evalTestCase(src);
//     });

//     test("type coalesce", () => {
//       const src = `x :> number`;
//       evalTestCase(src);
//     });

//     test("subtyping check", () => {
//       const src = `my_type <= number`;
//       evalTestCase(src);
//     });
//   });

//   describe.todo("signals", () => {
//     test("value", () => {
//       const src = `signal 123`;
//       evalTestCase(src);
//     });

//     test("derived", () => {
//       const src = `signal (x + y)`;
//       evalTestCase(src);
//     });
//   });
// });

import { beforeEach, describe, expect, it } from "vitest";
import {
  compileStatement,
  handleEffects,
  compileScript,
  newContext,
  newCompileContext,
} from "../src/evaluate/index.ts";
import { assert } from "../src/utils.ts";
import {
  atom,
  createRecord,
  EvalEffect,
  EvalRecord,
  EvalValue,
  fn,
  isChannel,
  isEffect,
  isSymbol,
} from "../src/values.ts";
import { parseTokens } from "../src/tokens.ts";
import { parseScript } from "../src/parser.ts";
import { addFile } from "../src/files.ts";
import { Injectable, register } from "../src/injector.ts";
import { FileMap } from "codespan-napi";
import { Environment, EnvironmentOptions, createSymbolMap } from "../src/environment.ts";
import { IOEffect, ThrowEffect } from "../src/std/prelude.ts";
import { sequence } from "../src/ast.ts";
import { isResult } from "../src/std/result.ts";

const ROOT_DIR = "/evaluate_tests";
const evaluate = async (input: string, env?: EnvironmentOptions & { handlers?: EvalRecord }): Promise<EvalValue> => {
  const name = ROOT_DIR + "/index.uni";
  const fileId = addFile(name, input);
  const compileContext = newCompileContext(fileId, name);
  const context = newContext();
  const tokens = parseTokens(input);
  const ast = parseScript(tokens);
  if (env) context.env = new Environment({ parent: context.env, ...env });

  if (env?.handlers) {
    const compiled = compileStatement(sequence(ast.children), compileContext);
    const result = await compiled(context);
    return await handleEffects(env.handlers, result, { start: 0, end: 0 }, context, compileContext);
  }

  const compiled = compileScript(ast, compileContext);
  const result = await compiled(context);
  return result;
};

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.RootDir, ROOT_DIR);
});

describe("advent of code 2023 day 1 single", () => {
  it("variable", async () => {
    const input = `
        document := "
          1abc2
          pqr3stu8vwx
          a1b2c3d4e5f
          treb7uchet
        "
      `;
    const result = await evaluate(input);
    expect(result).toEqual(`
          1abc2
          pqr3stu8vwx
          a1b2c3d4e5f
          treb7uchet
        `);
  });

  it("split lines", async () => {
    const mutable = createSymbolMap({
      document: `
        1abc2
        pqr3stu8vwx
        a1b2c3d4e5f
        treb7uchet
      `,
      map: fn(2, (cs, list, fn) => {
        assert(Array.isArray(list));
        assert(typeof fn === "function");
        return Promise.all(
          list.map(async (x) => {
            const result = await fn(cs, x);
            assert(result !== null);
            return result;
          })
        );
      }),
      filter: fn(2, async (cs, list, fn) => {
        assert(Array.isArray(list));
        assert(typeof fn === "function");
        const result: EvalValue[] = [];
        for (const item of list) {
          const keep = await fn(cs, item);
          if (keep) result.push(item);
        }
        return result;
      }),
    });
    const input = `
        mut lines := document.split("\\n")
        lines = map lines fn line do line.replace "\\\\s+" ""
        filter lines fn line -> line != ""
      `;
    const result = await evaluate(input, { mutable });
    expect(result).toEqual(["1abc2", "pqr3stu8vwx", "a1b2c3d4e5f", "treb7uchet"]);
  });

  it("parse numbers", async () => {
    const mutable = createSymbolMap({
      lines: ["1abc2", "pqr3stu8vwx", "a1b2c3d4e5f", "treb7uchet"],
      flat_map: fn(2, async (cs, list, fn) => {
        assert(Array.isArray(list));
        assert(typeof fn === "function");
        const mapped = await Promise.all(
          list.map(async (x) => {
            const result = await fn(cs, x);
            assert(result !== null);
            return result;
          })
        );
        return mapped.flat();
      }),
    });
    const input = `
        numbers := flat_map lines fn mut line {
          digits := ()
          while line != "" {
            if line.char_at(0).match("\\\\d") {
              digit := number (line.char_at(0))
              if !(0 in digits) do digits[0] = digit
              digits[1] = digit
            }
            line = line.slice(1,)
          }
          digits[0] * 10, digits[1]
        }
      `;
    const result = await evaluate(input, { mutable });
    expect(result).toEqual([10, 2, 30, 8, 10, 5, 70, 7]);
  });

  it("flat map list impl", async () => {
    const input = `
        flat_map := fn list, mapper {
          reduce list (fn acc, item -> (...acc, ...mapper item)) (fn first, second -> (...first, ...second)) ()
        }
      `;
    const result = await evaluate(input);
    expect(result).toMatchSnapshot();
  });

  it("reduce list", async () => {
    const input = `
        import "std/concurrency" as { all }
        import "std/math" as { floor }
  
        reduce := fn list, reducer, merge, initial {
          if list.length == 0 do return initial

          midpoint := floor(list.length / 2)
          item := list[midpoint]
          first, second := all(
            | (self (list.slice(0, midpoint)) reducer merge initial)
            | (self (list.slice(midpoint + 1,)) reducer merge initial)
          )
  
          merge (reducer first item) second
        };
  
        reduce (1, 2, 3, 4, 5) (fn acc, item -> acc + item) (fn first, second -> first + second) 0
      `;
    const result = await evaluate(input);
    expect(result).toBe(15);
  });

  it("filter list impl", async () => {
    const input = `
        predicate := true
        first := ()
        item := 1
        acc := ()
        if predicate do (...first, item) else acc
      `;
    const result = await evaluate(input);
    expect(result).toStrictEqual([1]);
  });

  describe("split list", () => {
    it("5", async () => {
      const input = `
        fn (mut list, mut start = 0, mut end = (list.length)) {
          {
            start--
            end--
            _, ...list = list
          }
            
          list, start, end
        } ((6,5,4,3,2,1), 4, 6)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });

    it("4", async () => {
      const input = `
        fn (mut list, mut start = 0, mut end = (list.length)) {
          {
            start--
            end--
            _, ...list = list
          }
            
          list, start, end
        } ((6,5,4,3,2,1), 4)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });

    it("3", async () => {
      const input = `
        fn (mut list, mut start = 0, mut end = (list.length)) {
          start--
          end--
          _, ...list = list
            
          list, start, end
        } ((6,5,4,3,2,1), 4)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });

    it("7", async () => {
      const input = `
        fn (mut list, mut start = 0, mut end = (list.length)) {
          start--
          end--
            
          start, end
        } ((6,5,4,3,2,1), 4)`;
      const result = await evaluate(input);
      expect(result).toEqual([3, 5]);
    });

    it("0", async () => {
      const input = `
        fn (mut list, mut start = 0, mut end = (list.length)) {
          start--
          end--
          _, ...list = list
            
          list, start, end
        } ((6,5,4,3,2,1), 4, 6)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });

    it("2", async () => {
      const input = `
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
        } ((6,5,4,3,2,1), 4)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });

    it("6", async () => {
      const input = `
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
        } ((6,5,4,3,2,1), 4, 6)`;
      const result = await evaluate(input);
      expect(result).toEqual([[5, 4, 3, 2, 1], 3, 5]);
    });
  });
});

describe("scope", () => {
  it("block shadowing", async () => {
    const input = `
        x := 1;
        { x := 2 };
        x
      `;
    const result = await evaluate(input);
    expect(result).toBe(1);
  });

  it("loop shadowing", async () => {
    const input = `
        x := 1
        loop { x := 2; break() }
        x
      `;
    const result = await evaluate(input);
    expect(result).toBe(1);
  });

  it("fn concurrent", async () => {
    const input = `
        import "std/concurrency" as { all }
        x := fn (a, b) do a + b
        all(x(1, 2) | x(3, 4))
      `;
    const result = await evaluate(input);
    expect(result).toEqual([3, 7]);
  });

  it("while block shadowing", async () => {
    const input = `
        number := 1
  
        while true {
          number := 5
          break()
        }
  
        number
      `;
    const result = await evaluate(input);
    expect(result).toEqual(1);
  });

  it("for block shadowing", async () => {
    const input = `
        number := 1;
  
        for x in 1, 2, 3 {
          number := 5;
          break()
        };
  
        number
      `;
    const result = await evaluate(input);
    expect(result).toEqual(1);
  });

  it("block assign", async () => {
    const input = `
        mut n := 1;
        { n = 5 };
        n
      `;
    const result = await evaluate(input);
    expect(result).toEqual(5);
  });

  it("block increment", async () => {
    const input = `
        mut n := 1;
        { n += 5 };
        n
      `;
    const result = await evaluate(input);
    expect(result).toEqual(6);
  });

  it("effect handlers inject scoping", async () => {
    const input = `
      x := 1;
      inject a: 1, b: 2 {
        x := 2;
      };
      x
    `;
    const result = await evaluate(input);
    expect(result).toEqual(1);
  });

  it("declaration shadowing and closures", async () => {
    const input = `
      x := 1
      f := fn do x
      x := 2
      f()
    `;
    const result = await evaluate(input);
    expect(result).toEqual(1);
  });
});

describe("expressions", () => {
  describe("values", async () => {
    it("integer", async () => {
      const input = `123`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("float", async () => {
      const input = `123.456`;
      const result = await evaluate(input);
      expect(result).toBe(123.456);
    });

    it("string", async () => {
      const input = `"string"`;
      const result = await evaluate(input);
      expect(result).toBe("string");
    });

    it("true", async () => {
      const input = `true`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("false", async () => {
      const input = `false`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });
  });

  describe("arithmetics", () => {
    it("order of application", async () => {
      const input = "1 + 2^-3 * 4 - 5 / 6 % 7";
      const result = await evaluate(input);
      expect(result).toBe(2 / 3);
    });

    it("post increment", async () => {
      const input = `
        mut x := 0
        x++, x        
      `;
      const result = await evaluate(input);
      expect(result).toEqual([0, 1]);
    });
  });

  describe("boolean expressions", () => {
    it("not on not boolean", async () => {
      const input = `!123`;
      expect(async () => await evaluate(input)).rejects.toThrow();
    });

    it("not on boolean", async () => {
      const input = `!true`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("and", async () => {
      const input = `true and false`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("and short-circuit", async () => {
      const input = `false and whatever`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("or", async () => {
      const input = `true or false`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("or short-circuit", async () => {
      const input = `true or whatever`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("in finds existing key", async () => {
      const input = `:key in (key: 1, key2: 2)`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("in not finds not existing key", async () => {
      const input = `"key3" in (key: 1, key2: 2)`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("in finds index holds value in tuple", async () => {
      const input = `1 in (1, 2)`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("in finds index not holds value in tuple", async () => {
      const input = `5 in (1, 2)`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("eq", async () => {
      const input = `1 == 1`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("eq ref", async () => {
      const input = `x := 1, 2; y := x; x == y`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("eq ref 2", async () => {
      const input = `(1, 2) == (1, 2)`;
      const result = await evaluate(input);
      expect(result).toBe(false);
    });

    it("deep eq", async () => {
      const input = `(1, 2) === (1, 2)`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("compare", async () => {
      const input = `123 < 456`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("and lhs creates scope", async () => {
      const input = `
        x := 2;
        true and (x := 1);
        x
      `;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("or lhs creates scope", async () => {
      const input = `
        x := 2;
        false or (x := 1);
        x
      `;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });
  });

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
  });

  describe("pattern matching", () => {
    it("with 'is' operator", async () => {
      const input = `1 is x`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("with record pattern", async () => {
      expect(await evaluate(`(a: 1, b: 2) is { a, b }`)).toBe(true);
      expect(await evaluate(`(a: 1, b: 2) is { a, b, c }`)).toBe(false);
      expect(await evaluate(`(a: 1, b: 2) is { a }`)).toBe(true);
      expect(await evaluate(`1 is { a }`)).toBe(false);
    });

    it("with record pattern rename", async () => {
      expect(await evaluate(`(a: 1, b: 2) is { a: c, b }`)).toBe(true);
      expect(await evaluate(`(a: 1, b: 2) is { c: a, d: b }`)).toBe(false);
      expect(await evaluate(`(a: 1, b: 2) is { a: 1 }`)).toBe(true);
    });

    it("with record pattern nested", async () => {
      expect(await evaluate(`(a: (1, 2), b: 2) is { a: (c, d) }`)).toBe(true);
      expect(await evaluate(`(a: (1, 2), b: 2) is { a: { b } }`)).toBe(false);
    });

    it("with record pattern key", async () => {
      expect(await evaluate(`(3: 1, b: 2) is { [1 + 2]: c, b }`)).toBe(true);
      expect(await evaluate(`(3: 1, b: 2) is { [1 + 1]: c, d }`)).toBe(false);
    });

    it("with constant value", async () => {
      expect(await evaluate(`1 is 1`)).toBe(true);
      expect(await evaluate(`1 is 2`)).toBe(false);
    });

    it("with placeholder", async () => {
      const input = `1 is _`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("with variable value", async () => {
      expect(await evaluate(`a:= 1; (1, 2) is (^a, b)`)).toBe(true);
      expect(await evaluate(`a:= 1; (2, 2) is (^a, b)`)).toBe(false);
      expect(await evaluate(`a:= 1; (2, 2) is (^(a + 1), b)`)).toBe(true);
    });

    it("with rest value", async () => {
      const input = `(1, 2, 3) is (a, ...b)`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("with rest value first", async () => {
      const input = `(1, 2, 3) is (...b, a)`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("with tuple pattern", async () => {
      expect(await evaluate(`(1, 2) is (a, b)`)).toBe(true);
      expect(await evaluate(`(1, 2) is (a, b, c)`)).toBe(false);
      expect(await evaluate(`(1, 2) is (a,)`)).toBe(true);
    });

    it("with default value", async () => {
      expect(await evaluate(`(2, 1) is (a, b = 4)`)).toBe(true);
      expect(await evaluate(`(2,) is (a, b = 4)`)).toBe(true);
      expect(await evaluate(`(2,) is (1, b = 4)`)).toBe(false);
      expect(await evaluate(`(a, b = 4) := (1,); b`)).toBe(4);
      expect(await evaluate(`(a, b = 4) := (1, 2); b`)).toBe(2);
    });

    it("with like pattern", async () => {
      expect(await evaluate(`(1, 2) is like (a, b)`)).toBe(true);
      expect(await evaluate(`(1, 2) is like (a, b, c)`)).toBe(true);
      expect(await evaluate(`(1, 2) is like (a, (b, c))`)).toBe(false);
      expect(await evaluate(`(1, (2, 3)) is like (a, strict (b, c))`)).toBe(true);
      expect(await evaluate(`(1, (2,)) is like (a, strict (b, c))`)).toBe(false);
      expect(await evaluate(`(1, 2) is like (a, strict (b, c))`)).toBe(false);

      expect(await evaluate(`(a: 1, b: 2) is like { a, b }`)).toBe(true);
      expect(await evaluate(`(a: 1, b: 2) is like { a, b, c }`)).toBe(true);
      expect(await evaluate(`(a: 1, b: (b: 2, c: 3)) is like { a, b: strict { b, c } }`)).toBe(true);
      expect(await evaluate(`(a: 1, b: (b: 2)) is like { a, b: strict { b, c } }`)).toBe(false);
      expect(await evaluate(`(a: 1, b: 2) is like { a, b: strict { b, c } }`)).toBe(false);
    });

    it("with record default value", async () => {
      expect(await evaluate(`(a: 2, b: 1) is { b = 4, a }`)).toBe(true);
      expect(await evaluate(`(a: 2) is { b = 4, a: 1 }`)).toBe(false);
      expect(await evaluate(`{ b = 4, a } := (a: 1); b`)).toBe(4);
      expect(await evaluate(`{ b = 4, a } := (a: 1, b: 2); b`)).toBe(2);
    });

    it("with rename", async () => {
      expect(await evaluate(`(1, 2) is (a @ b, c)`)).toBe(true);
      expect(await evaluate(`(1, 2) is (2 @ b, c)`)).toBe(false);
      expect(await evaluate(`(1, 2) is (a @ 1, c)`)).toBe(true);
      expect(await evaluate(`(a @ b, c) := (1, 2); a, b, c`)).toEqual([1, 1, 2]);
      expect(await evaluate(`((a, b) @ c) := (1, 2); a, b, c`)).toEqual([1, 2, [1, 2]]);
    });

    it("with multiple bind of same name", async () => {
      expect(await evaluate(`(1, 1) is (x, x)`)).toBe(true);
      expect(await evaluate(`(1, 2) is (x, x)`)).toBe(false);
    });

    it("with dynamic variable name", async () => {
      const input = `1 is [:dyn] and 1 == [:dyn]`;
      const result = await evaluate(input);
      expect(result).toEqual(true);
    });

    it("is binding visible in scope where it is true", async () => {
      const input = `(2, 1) is (a, b) and a == b + 1`;
      const result = await evaluate(input);
      expect(result).toBe(true);
    });

    it("default value using current pattern's variable", async () => {
      const input = `if (1,) is (a, b = (a + 1), c = (b + 1)) do (a, b, c)`;
      const result = await evaluate(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("switch", async () => {
      const input = `switch 1 { 1 -> 2, 3 -> 4 }`;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("in function parameters", async () => {
      const input = `((x, y) -> x + y)(1, 2)`;
      const result = await evaluate(input);
      expect(result).toBe(3);
    });

    it("evaluate drop last", async () => {
      const input = `
          mut list := 1, 2, 3;
          ...list, _ = list;
          list
        `;
      const result = await evaluate(input);
      expect(result).toEqual([1, 2]);
    });

    it("assign", async () => {
      expect(await evaluate(`mut x := (a: 1, b: 2); x.a = 3; x`)).toEqual(createRecord({ a: 3, b: 2 }));
      expect(await evaluate(`mut x := (a: 1, b: 2); x[:b] = 4; x`)).toEqual(createRecord({ a: 1, b: 4 }));
      expect(await evaluate(`mut x := (1, 2); x[0] = 3; x`)).toEqual([3, 2]);
    });
  });

  describe("structured programming", () => {
    it("label", async () => {
      const input = `label::{ label.break 1; 2 }`;
      const result = await evaluate(input);
      expect(result).toBe(1);
    });

    it("label loop if-then", async () => {
      const input = `
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
      `;
      const result = await evaluate(input);
      expect(result).toEqual([4, 3, 69, 1, 0]);
    });

    it("if is", async () => {
      const input = `if 1 is a do a + 1`;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("if is not", async () => {
      const input = `if 1 is not a do 0 else a + 1`;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("if-then", async () => {
      const input = `if true do 123`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("if-then-else", async () => {
      const input = `if true do 123 else 456`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("if-then-elseif-then-else", async () => {
      const input = `if true do 123 else if false do 789 else 456`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("block", async () => {
      const input = `{ 123 }`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("empty block is null", async () => {
      const input = `{}`;
      const result = await evaluate(input);
      expect(result).toBe(null);
    });

    it("sequencing", async () => {
      const input = `123; 234; 345; 456`;
      const result = await evaluate(input);
      expect(result).toBe(456);
    });

    it("for loop", async () => {
      const input = `for x in (1, 2, 3) do x`;
      const result = await evaluate(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("for loop map", async () => {
      const input = `for x in (1, 2, 3) do x+1`;
      const result = await evaluate(input);
      expect(result).toEqual([2, 3, 4]);
    });

    it("for loop filter", async () => {
      const input = `for x in (1, 2, 3) do if x > 1 do x + 1`;
      const result = await evaluate(input);
      expect(result).toEqual([3, 4]);
    });

    it("while loop continue", async () => {
      const input = `mut x := 0; mut y := (); while x < 3 { x++; if x == 1 do continue(); y = ...y, x }; x, y`;
      const result = await evaluate(input);
      expect(result).toEqual([3, [2, 3]]);
    });

    it("while loop break", async () => {
      const input = `while true do break _`;
      const result = await evaluate(input);
      expect(result).toBe(null);
    });

    it("while loop break value", async () => {
      const input = `while true do break 1`;
      const result = await evaluate(input);
      expect(result).toBe(1);
    });

    it("while loop", async () => {
      const input = `mut x := 0; while x < 10 do x++; x`;
      const result = await evaluate(input);
      expect(result).toBe(10);
    });

    it("return", async () => {
      const input = `(() -> { return 123; 456 })()`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("variable declaration with null", async () => {
      const input = `{ x := {} }`;
      expect(async () => await evaluate(input)).rejects.toThrow();
    });

    it("non-strict variable declaration with null", async () => {
      const input = `{ like x := {} }`;
      expect(await evaluate(input)).toEqual(null);
    });

    it("block variable declaration", async () => {
      const input = `{ x := 123; x }`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("block mutable variable declaration", async () => {
      const input = `{ mut x := 123 }`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("block variable assignment", async () => {
      const input = `mut x := 1; { x = 123 }; x`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("dynamic variable name", async () => {
      expect(await evaluate(`x := 1; [:x]`)).toBe(1);
      expect(await evaluate(`[:x] := 1; [:x]`)).toBe(1);
      expect(await evaluate(`[:x] := 1; x`)).toBe(1);
      expect(await evaluate(`name := :x; [name] := 1; [name]`)).toBe(1);
      expect(async () => await evaluate(`name := 2; [name] := 1; [name]`)).rejects.toThrow();
      expect(async () => await evaluate(`[2] := 1; [2]`)).rejects.toThrow();
    });

    it("block as argument", async () => {
      const input = `
        f := fn x { x() }
        f { 123 }
      `;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    describe("resource handling", () => {
      it("rest", async () => {
        const input = `
          import "std/io" as io

          // file closed at the end of file
          io.open "./file.txt" file ->
          file.write("hello")

          123
        `;
        const written: unknown[] = [];
        let closed = false;
        let opened = false;
        const ioHandler = createRecord({
          open: fn(2, async (cs, _path, continuation) => {
            assert(typeof _path === "string");
            opened = true;
            const file = createRecord({
              write: fn(1, (_cs, data) => (written.push(data), null)),
              close: fn(1, () => ((closed = true), null)),
            });

            assert(typeof continuation === "function");
            continuation(cs, file);
            return null;
          }),
        });
        const handlers = createRecord({ [IOEffect]: ioHandler });

        const result = await evaluate(input, { handlers });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });

      it("block", async () => {
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
        const ioHandler = createRecord({
          open: fn(2, async (cs, _path, continuation) => {
            assert(typeof _path === "string");
            opened = true;
            const file = createRecord({
              write: fn(1, (_cs, data) => (written.push(data), null)),
              close: fn(1, () => ((closed = true), null)),
            });

            assert(typeof continuation === "function");
            continuation(cs, file);
            return null;
          }),
        });
        const handlers = createRecord({ [IOEffect]: ioHandler });

        const result = await evaluate(input, { handlers });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });

      it("do", async () => {
        const input = `
          import "std/io" as io

          // file closed at the end of statement
          io.open "./file.txt" fn file do
            file.write("hello")

          123
        `;
        const written: unknown[] = [];
        let closed = false;
        let opened = false;
        const ioHandler = createRecord({
          open: fn(2, async (cs, _path, continuation) => {
            assert(typeof _path === "string");
            opened = true;
            const file = createRecord({
              write: fn(1, (_cs, data) => (written.push(data), null)),
              close: fn(1, () => ((closed = true), null)),
            });

            assert(typeof continuation === "function");
            continuation(cs, file);
            return null;
          }),
        });
        const handlers = createRecord({ [IOEffect]: ioHandler });

        const result = await evaluate(input, { handlers });
        expect(result).toBe(123);
        expect(written).toEqual(["hello"]);
        expect(opened).toBe(true);
        expect(closed).toBe(true);
      });
    });

    // describe('dangling resources', () => {
    //   it.todo('through mutation', async () => {
    //     const input = `
    //       import "std/io" as { open };

    //       handle := ()

    //       // file closed at the end of block
    //       open "file.txt" fn file {
    //         file.write("hello")
    //         handle = file
    //       }

    //       handle.write("world") // error
    //     `;
    //     const result = await evaluate(input);
    //     expect(result).toBe('hello');
    //   });

    //   it.todo('through closure', async () => {
    //     const input = `
    //       import "std/io" as { open };

    //       // file closed at the end of block
    //       handle := open "file.txt" fn file {
    //         file.write("hello")

    //         fn do file.write("world")
    //       }

    //       handle() // error
    //     `;
    //     const result = await evaluate(input);
    //     expect(result).toBe('hello');
    //   });

    //   it.todo('through data', async () => {
    //     const input = `
    //       import "std/io" as { open };

    //       // file closed at the end of block
    //       status, handle := open "file.txt" fn file {
    //         file.write("hello")

    //         :done, file
    //       }

    //       handle.write("world") // error
    //     `;
    //     const result = await evaluate(input);
    //     expect(result).toBe('hello');
    //   });
    // });

    describe("error handling", () => {
      it("try throw", async () => {
        const input = `
          f := fn { throw 123 }
          try { f() }
        `;
        const result = await evaluate(input);
        assert(isResult(result));
        expect(result.value).toEqual([atom("error"), 123]);
      });

      it("try", async () => {
        const input = `
          f := fn { 123 }
          try { f() }
        `;
        const result = await evaluate(input);
        assert(isResult(result));
        expect(result.value).toEqual([atom("ok"), 123]);
      });

      it("no try", async () => {
        const input = `
          f := fn { throw 123 }
          f()
        `;
        const result = await evaluate(input);
        expect(isEffect(result)).toBe(true);
        expect((result as EvalEffect).effect).toStrictEqual(ThrowEffect);
        expect((result as EvalEffect).value).toStrictEqual(123);
      });

      it("try unwrap ok result", async () => {
        const input = `
          f := fn { try { 123 } }
          g := fn { x := f()?; x + 1 }

          g().unwrap
        `;
        const result = await evaluate(input);
        expect(result).toBe(124);
      });

      it("try unwrap error result", async () => {
        const input = `
          f := fn { try { throw 123 } }
          g := fn { x := f()?; x + 1 }

          g()
        `;
        const result = await evaluate(input);
        assert(isResult(result));
        expect(result.value).toStrictEqual([atom("error"), 123]);
      });

      it("unwrap ok result", async () => {
        const input = `
          f := fn { try { 123 } }
          g := fn { x := (f()).unwrap; x + 1 }

          g()
        `;
        const result = await evaluate(input);
        expect(result).toBe(124);
      });

      it("unwrap error result", async () => {
        const input = `
          f := fn { try { throw 123 } }
          g := fn { x := (f()).unwrap; x + 1 }

          g()
        `;
        const result = await evaluate(input);
        expect(isEffect(result)).toBe(true);
        expect((result as EvalEffect).effect).toStrictEqual(ThrowEffect);
        expect((result as EvalEffect).value).toStrictEqual(123);
      });

      it("try map err", async () => {
        const input = `
          f := fn { throw 123 }

          try(f).map_err(err -> "wha", err)
        `;
        const result = await evaluate(input);
        assert(isResult(result));
        expect(result.value).toEqual([atom("error"), ["wha", 123]]);
      });
    });
  });

  describe("concurrent programming", () => {
    it("parallel all", async () => {
      const input = `
          import "std/concurrency" as { all };
          all(1 | 2)
        `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([1, 2]);
    });

    it("parallel some", async () => {
      const input = `
          import "std/concurrency" as { some };
          some(1 | 2)
        `;
      const result = await evaluate(input);
      expect(result === 1 || result === 2).toBe(true);
    });

    it("parallel all multiline", async () => {
      const input = `
          import "std/concurrency" as { all };
          all(
            | 1
            | 2
          )
        `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([1, 2]);
    });

    it("channels sync", async () => {
      const input = `
          lines := channel "lines"
    
          async {
            lines <- "1"
            close lines
          }
    
          while true {
            value, status := <-? lines
            if status == :empty do continue()
            if status == :closed do break()
            value
          }
        `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([]);
    });

    it("channels sync 2", async () => {
      const input = `
          lines := channel "lines"
    
          async {
            lines <- "1"
            lines <- "2"
            close lines
          };
    
          while true {
            value, status := <-?lines
            if status == :empty do continue()
            if status == :closed do break()
            value
          }
        `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([]);
    });

    it("channel send receive", async () => {
      const input = `c := channel "test"; async c <- 123; <- c`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("parallel value", async () => {
      const input = `tasks := 123 | 456; await tasks[0], await tasks[1]`;
      const result = await evaluate(input);
      expect(result).toEqual([123, 456]);
    });

    it("parallel with channels", async () => {
      const input = `c := channel "test"; tasks := c <- 123 | <- c; await tasks[1]`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("await async", async () => {
      const input = `f := fn x do x + 1; await async f 1`;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("await", async () => {
      const input = `x := async 1; await x + 1`;
      const result = await evaluate(input);
      expect(result).toBe(2);
    });

    it("select", async () => {
      const input = `c1 := channel "test"; c2 := channel "test"; async c1 <- 123; async c2 <- 456; <- c2 + c1`;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("select concurrent", async () => {
      const input = `c1 := channel "test"; c2 := channel "test"; c1 <- 123 | c2 <- 456; <- c2 + c1`;
      const result = await evaluate(input);
      expect(result === 123 || result === 456).toBe(true);
    });

    it("wait", async () => {
      const input = `
        import "std/concurrency" as { wait };
        
        wait 500;
        123
      `;
      const result = await evaluate(input);
      expect(result).toBe(123);
    });

    it("force sync", async () => {
      const input = `
        import "std/concurrency" as { creating_task };

        without creating_task {
          async 123 // throws, since creating tasks is not allowed
        };
      `;
      expect(async () => await evaluate(input)).rejects.toThrow();
    });

    it("event emitter", async () => {
      const input = `
        emitter := event()
        mut counter := ""
        subscribe emitter fn x do counter += x + "1"
        once emitter fn x do counter += x + "2"
        
        emit emitter "hello"

        counter
      `;
      const result = await evaluate(input);
      expect(result).toEqual("hello1hello2");
    });

    it("chan collect to list", async () => {
      const input = `
        import "std/concurrency" as { wait }
  
        mut list := ()
        chan := channel()
  
        async {
          x2 := <- chan
          list = (x2,)
          x1 := <- chan
          list = (x2, x1)
        }

        chan <- 1
        wait 0
        list
      `;
      const result = await evaluate(input);
      expect(result).toEqual([1]);
    });

    describe("structured concurrency", () => {
      it("cancelling", async () => {
        const input = `
          import "std/concurrency" as { wait };

          task := async {
            wait 1000
            123
          }
          
          cancel task
          await task
        `;
        const result = await evaluate(input);
        expect(result).toStrictEqual(null);
      });

      it("cancel propagation", async () => {
        const input = `
          import "std/concurrency" as { wait };

          mut counter := 0
          task := async {
            async { wait 200; counter += 1 }
            wait 50
            counter += 1
            wait 200
            123
          };

          wait 100
          cancel task
          counter
        `;
        const result = await evaluate(input);
        expect(result).toStrictEqual(1);
      });

      it("cancel_on_error policy", async () => {
        const input = `
          import "std/concurrency" as { wait, cancel_on_error }
          
          mut counter := 0
          handled := cancel_on_error {
            async { wait 100; counter += 1 }
            async { wait 300; counter += 1 }
            
            counter += 1

            wait 200
            throw "error"
          }

          handled, counter
        `;
        const result = await evaluate(input);
        expect(result).toStrictEqual(["error", 2]);
      });

      it("cancel_on_return policy", async () => {
        const input = `
          import "std/concurrency" as { wait, cancel_on_return, some };
          
          mut counter := 1
          handled := cancel_on_return {
            some (
              | { wait 100; counter += 1; 1 }
              | { wait 200; counter += 2; 2 }
            )
          }

          handled, counter
        `;
        const result = await evaluate(input);
        expect(result).toStrictEqual([1, 2]);
      });

      it("timeout", async () => {
        const input = `
          import "std/concurrency" as { timeout, wait }
          mut counter := 0
          
          timeout 100 {
            counter += 1
            wait 200
            counter += 1
          }

          counter
        `;
        const result = await evaluate(input);
        expect(result).toStrictEqual(1);
      });
    });
  });

  describe("effect handlers", () => {
    it("all in one", async () => {
      const input = `
        inject a: 1, b: 2 {
          a := handle (:a) ()
          b := handle (:b) ()
          inject a: a+1, b: b+2 {
            mask :a {
              without :b {
                a := handle (:a) ()
                a + 1
              }
            }
          }  
        }
      `;
      const result = await evaluate(input);
      expect(result).toEqual(2);
    });

    it("inject", async () => {
      const input = `inject a: 1, b: 2 -> handle (:a) (), handle (:b) ()`;
      const result = await evaluate(input);
      expect(result).toEqual([1, 2]);
    });

    it("inject shadowing", async () => {
      const input = `
        inject a: 1, b: 2 ->
        a := handle (:a) ()
        b := handle (:b) ()
          
        inject a: a+1, b: b+2 ->

        handle (:a) (),
        handle (:b) ()
      `;
      const result = await evaluate(input);
      expect(result).toEqual([2, 4]);
    });

    it("mask", async () => {
      const input = `
        inject a: 1, b: 2 ->
        a := handle (:a) ()
        b := handle (:b) ()
        
        inject a: a+1, b: b+2 ->
        mask :a ->
        a := handle (:a) ()
        b := handle (:b) ()
        a, b
      `;
      const result = await evaluate(input);
      expect(result).toEqual([1, 4]);
    });

    it("without", async () => {
      const input = `
        inject a: 1 ->
        without :a ->
        (:a |> handle) ()  
      `;
      expect(async () => await evaluate(input)).rejects.toThrow();
    });

    it("parallel", async () => {
      const input = `
        f := fn {
          a := handle (:a) ()
          b := handle (:b) ()
          a + b
        }
        
        inject a: 1, b: 2 ->
        x1 := f()
        x2 := async { inject a: 3       do f() }
        x3 := async { inject a: 5, b: 4 do f() }
        x1, await x2, await x3
      `;
      const result = await evaluate(input);
      expect(result).toEqual([3, 5, 9]);
    });

    it("block-inject-fn-handle twice", async () => {
      const input = `
        f := fn {
          handle (:a) ()
          handle (:a) ()
        }
        
        { inject a: 3 do f() }
      `;
      const result = await evaluate(input);
      expect(result).toEqual(3);
    });

    it("block-inject-fn-handle", async () => {
      const input = `
        f := fn do handle (:a) ()
        { inject a: 3 do f() }
      `;
      const result = await evaluate(input);
      expect(result).toEqual(3);
    });

    it("multiple continuation calls", async () => {
      const input = `
        decide := :decide |> handle
        _handler := decide: handler fn (callback, value) {
            x1 := callback(true)
            x2 := callback(false)
            x1, x2
          }
        inject _handler ->
        if decide() do 123 else 456
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([123, 456]);
    });

    it("multiple continuation calls with mutations and refs", async () => {
      const input = `        
        _handler :=
          do: handler fn (callback, _) {
            callback()
            callback()
          }
        
        m := inject _handler {
          m := (1,)
          handle (:do) ()
          m[0] = m[0] + 1
          m
        }

        m
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([3]);
    });

    it("multiple continuation calls with mutations and closure", async () => {
      const input = `        
          _handler :=
            do: handler fn (callback, _) {
              callback()
              callback()
            }
          
          mut n := 1
          m, f := inject _handler {
            mut m := 1
            f := fn do m
            handle (:do) ()
            g := fn do m, f()
            m = m + 1
            n = n + 1
            m, g
          }

          m, n, f()
        `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([2, 3, [2, 2]]);
    });

    it("multiple continuation calls with mutations", async () => {
      const input = `        
        _handler :=
          do: handler fn (callback, _) {
            callback()
            callback()
          }
        
        mut n := 1
        inject _handler {
          mut m := 1
          handle (:do) ()
          m = m + 1
          n = n + 1
          m, n
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([2, 3]);
    });

    it("multiple continuation calls with inner mutation", async () => {
      const input = `        
        _handler :=
          do: handler fn (callback, _) {
            callback()
            callback()
          }
        
        inject _handler {
          mut m := 1
          handle (:do) ()
          m = m + 1
          m
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(2);
    });

    it("no continuation calls sequential", async () => {
      const input = `
        decide := :decide |> handle
        _handler := decide: handler fn (callback, value) do 126
        inject _handler ->
        decide(); 123
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(126);
    });

    it("no continuation calls", async () => {
      const input = `
        decide := :decide |> handle
        _handler := decide: handler fn (callback, value) do 126
        inject _handler ->
        if decide() do 123 else 456
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(126);
    });

    it("single continuation call", async () => {
      const input = `
        decide := :decide |> handle
        _handler := decide: handler fn (callback, value) do callback true
        inject _handler ->
        if decide() do 123 else 456
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(123);
    });

    it("multi-level state backtracking", async () => {
      const input = `
        inject
          [:do]: handler fn (callback, _) {
            callback false
            callback true
          }
        {
          mut m := 1
          without () -> // just creates new scope
          if (:do |> handle)() do m
          else m++
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(1);
    });

    it("disjoint-level state backtracking", async () => {
      const input = `
        inject
          [:do]: handler fn (callback, _) {
            break_handler := [:break]: handler fn (_, v) { v }
            inject break_handler { callback() }
          }
        {
          (:do |> handle) ()
          (:break |> handle) 1
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(1);
    });

    it("choose int loop", async () => {
      const input = `
        decide := :decide |> handle
        fail := :fail |> handle
        
        false_branch_first :=
          decide: handler fn (callback, _) {
            fail_handler := fail: handler fn { callback true }
            inject fail_handler { callback false }
          };
          
        inject false_branch_first {
          mut m, n := 1, 3
          a := loop {
            if m > n do fail()
            if decide() do break m
            m++
          }
          if a != 2 do fail()
          a
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(2);
    });

    it("unhandled fail", async () => {
      const input = `
        inject [:do]: handler fn (callback, _) { callback true } {
          { if (:do |> handle)() do break 1 else 2 }
          (:fail |> handle)()
        }
      `;
      const result = await evaluate(input);
      expect(isEffect(result)).toBe(true);
      expect((result as EvalEffect).effect).toStrictEqual(atom("fail"));
    });

    it("choose int recursion", async () => {
      const input = `
        decide := :decide |> handle
        fail := :fail |> handle
        choose_int := fn (m, n) {
          if m > n do fail()
          if decide() do m else self(m+1, n)
        }
        
        false_branch_first :=
          decide: handler fn (callback, _) {
            fail_handler := fail: handler fn {
              callback false
            }
            inject fail_handler { callback true }
          };
          
        inject false_branch_first {
          a := choose_int(1, 3)
          if a != 2 do fail()
          a
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual(2);
    });

    it("pythagorean triple example", async () => {
      const input = `
        import "std/math" as { floor, sqrt }

        decide := :decide |> handle
        fail := :fail |> handle
        choose_int := fn (m, n) {
          if m > n do fail()
          if decide() do m else self(m+1, n)
        }

        pythagorean_triple := fn m, n {
          a := choose_int(m, n);
          b := choose_int(a + 1, n + 1);
          c := sqrt (a^2 + b^2);
          if floor c != c do fail()

          (a, b, c)
        };
        
        false_branch_first :=
          decide: handler fn (callback, _) {
            fail_handler := fail: handler fn do callback false
            inject fail_handler { callback true }
          };
        true_branch_first :=
          decide: handler fn (callback, _) {
            fail_handler := fail: handler fn do callback true
            inject fail_handler { callback false }
          };

        inject false_branch_first { pythagorean_triple 4 15 },
        inject true_branch_first { pythagorean_triple 4 15 }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([
        [5, 12, 13],
        [12, 16, 20],
      ]);
    });

    it("logger example", async () => {
      const input = `
        logger :=
          log: handler fn (callback, msg) {
            result, logs := callback msg
            result, (msg, ...logs)
          },
          [return_handler]: fn x do x, ()

        log := handle(:log)

        f := fn do log 234

        inject logger {
          log 123
          log 456
          123, f()
        }
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([
        [123, 234],
        [123, 456, 234],
      ]);
    });

    it("transaction example", async () => {
      const input = `
        // can abstract db queries for example, instead of simple value state
        state :=
          get: handler fn (callback, _) {
            fn state do (callback state) state
          },
          set: handler fn (callback, state) {
            fn do (callback state) state
          },
          [return_handler]: fn x {
            fn state do state, x
          }
        transaction :=
          get: handler fn (callback, _) {
            fn state do (callback state) state
          },
          set: handler fn (callback, state) {
            fn do (callback state) state
          },
          [return_handler]: fn x {
            fn state { set state; x }
          }

        set := :set |> handle
        get := :get |> handle

        inject state {
          set 123
          inject transaction {
            set(get() + 1)
            get()
          }
          get() + 234
        } 1
      `;
      const result = await evaluate(input);
      expect(result).toStrictEqual([123, 357]);
    });
  });

  describe("data structures", () => {
    it("unit", async () => {
      const input = `()`;
      const result = await evaluate(input);
      expect(result).toStrictEqual([]);
    });

    it("symbol", async () => {
      const input = `symbol "name"`;
      const result = await evaluate(input);
      expect(isSymbol(result)).toBe(true);
    });

    it("channel", async () => {
      const input = `channel "name"`;
      const result = await evaluate(input);
      expect(isChannel(result)).toBe(true);
    });

    it("atom (global symbol)", async () => {
      const input = `:atom`;
      const result = await evaluate(input);
      expect(isSymbol(result)).toBe(true);
    });

    it("tuple", async () => {
      const input = `1, 2`;
      const result = await evaluate(input);
      expect(result).toStrictEqual([1, 2]);
    });

    it("record", async () => {
      const input = `a: 1, b: 2`;
      const result = await evaluate(input);
      expect(result).toStrictEqual(createRecord({ a: 1, b: 2 }));
    });

    it("set", async () => {
      const input = `set(1, 2, 2).values()`;
      const result = await evaluate(input);
      expect(result).toEqual([1, 2]);
    });

    it("dictionary", async () => {
      const input = `[1]: 2, [3]: 4`;
      const result = await evaluate(input);
      expect(result).toStrictEqual(
        createRecord([
          [1, 2],
          [3, 4],
        ])
      );
    });

    it("map without braces", async () => {
      const input = `1+2: 3, 4+5: 6`;
      const result = await evaluate(input);
      expect(result).toStrictEqual(
        createRecord([
          [3, 3],
          [9, 6],
        ])
      );
    });

    it("field access static", async () => {
      const input = `record := a: 1, b: 2; record.a`;
      const result = await evaluate(input);
      expect(result).toBe(1);
    });

    it("field access dynamic", async () => {
      const input = `map := "some string": 1, b: 2; map["some string"]`;
      const result = await evaluate(input);
      expect(result).toBe(1);
    });
  });
});
