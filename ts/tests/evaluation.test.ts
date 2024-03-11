import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { infixArithmeticOps, prefixArithmeticOps } from "../src/parser/constants";
import { parseExprString } from "../src/parser/string";
import { parseTokens } from "../src/parser/tokens";
import { parse } from "../src/parser";
import { omitASTDataScope } from "../src/utils";
import { evaluate } from "../src/evaluation";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

export const evalTestCase = (src, expectedValue?, expectedTree?) => {
  const [tokens] = parseTokens(src);
  const [tree, errors] = parse()(tokens);
  // console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  const _tree = omitASTDataScope(tree);
  if (expectedTree) expect(_tree).toEqual(expectedTree);
  expect(_tree).toMatchSnapshot();

  const result = evaluate(tree);
  if (expectedValue) expect(result).toEqual(expectedValue);
  expect(result).toMatchSnapshot();
};

export const evalTestCaseArgs = (src, expectedValue?) =>
  [`produces correct tree for '${src}'`, () => evalTestCase(src, expectedValue)] as const;

/* one test per example of a language construct  */

describe("comments", () => {
  test("comment", () => {
    const src = `// comment\n123`;
    evalTestCase(src);
  });

  test("comment block", () => {
    const src = `/* comment block */123`;
    evalTestCase(src);
  });
});

describe("expressions", () => {
  describe("values", () => {
    test("integer", () => {
      const src = `123`;
      evalTestCase(src);
    });

    test("float", () => {
      const src = `123.456`;
      evalTestCase(src);
    });

    test("string", () => {
      const src = `"string"`;
      evalTestCase(src);
    });

    test("true", () => {
      const src = `true`;
      evalTestCase(src);
    });

    test("false", () => {
      const src = `false`;
      evalTestCase(src);
    });
  });

  describe("arithmetics", () => {
    for (const [opName, op] of infixArithmeticOps) {
      test(opName, () => {
        const src = `123 ${op} 456`;
        evalTestCase(src);
      });
    }

    for (const [opName, op] of prefixArithmeticOps) {
      test(opName, () => {
        const src = `${op}123`;
        evalTestCase(src);
      });
    }

    it(...evalTestCaseArgs("1 + 2^3 * 4 - 5 / 6 % 7"));
  });

  describe("boolean expressions", () => {
    test("not", () => {
      const src = `!123`;
      evalTestCase(src);
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
          evalTestCase(src);
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) => Iterator.iter(pair).power(2))) {
        test(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
          evalTestCase(src);
        });
      }
    });
  });

  describe("function expressions", () => {
    test("function with no arg", () => {
      const src = `fn -> #0`;
      evalTestCase(src);
    });

    test("function with shadowed name access", () => {
      const src = `fn a -> fn a -> #a`;
      evalTestCase(src);
    });

    test("function with deep shadowed name access", () => {
      const src = `fn a -> fn a -> fn a -> ##a`;
      evalTestCase(src);
    });

    describe("application", () => {
      test("function call", () => {
        const src = `f x`;
        evalTestCase(src);
      });

      test("function call multiple args", () => {
        const src = `f x y`;
        evalTestCase(src);
      });
    });
  });

  describe("pattern matching", () => {
    test("match", () => {
      const src = `match x { 1 -> 2; 3 -> 4 }`;
      evalTestCase(src);
    });

    test("match that accepts tuple", () => {
      const src = `match x: ((1 -> 2), (3 -> 4))`;
      evalTestCase(src);
    });

    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
      evalTestCase(src);
    });

    describe("set-theoretic patterns", () => {
      test("pattern union", () => {
        const src = `((x:x, y:y) or (y:y, z:z)) -> y`;
        evalTestCase(src);
      });

      test("pattern intersection", () => {
        const src = `((x:x, y:y) and (z:z)) -> x + y + z`;
        evalTestCase(src);
      });

      test("pattern negation", () => {
        const src = `(!(x:x, y:y)) -> x + y + z`;
        evalTestCase(src);
      });
    });

    test("with 'is' operator", () => {
      const src = `x is (a, b)`;
      evalTestCase(src);
    });

    test("with placeholder", () => {
      const src = `x is (_, b)`;
      evalTestCase(src);
    });

    test("with variable value", () => {
      const src = `x is (^a, b)`;
      evalTestCase(src);
    });

    test("with rest value", () => {
      const src = `x is (a, ...b)`;
      evalTestCase(src);
    });

    test("with rest value first", () => {
      const src = `x is (...b, a)`;
      evalTestCase(src);
    });

    test("with default value", () => {
      const src = `x is ((b = 4), a)`;
      evalTestCase(src);
    });

    test("with rename", () => {
      const src = `x is (a @ b, c)`;
      evalTestCase(src);
    });

    test("with name for match", () => {
      const src = `x is ((a, b) @ c)`;
      evalTestCase(src);
    });

    test.todo("with type", () => {
      const src = `x is (b as number, a)`;
      evalTestCase(src);
    });

    test("binding visible in scope where it is true", () => {
      const src = `x is (a, b) and a == b + 1`;
      evalTestCase(src);
    });
  });

  describe("structured programming", () => {
    test.only("if-then", () => {
      const src = `y := (x := 25; loop if x <= 0: break x else { y := x; x = x - 1; if y == 19: continue 69; y })`;
      evalTestCase(src);
    });

    test("if-then", () => {
      const src = `if true: 123`;
      evalTestCase(src);
    });

    test("if-then newline", () => {
      const src = `if true\n 123`;
      evalTestCase(src);
    });

    test("if-then-else", () => {
      const src = `if true: 123 else 456`;
      evalTestCase(src);
    });

    test("if-then-elseif-then-else", () => {
      const src = `if true: 123 else if false: 789 else 456`;
      evalTestCase(src);
    });

    test("if-then newline-else", () => {
      const src = `if true\n 123 else 456`;
      evalTestCase(src);
    });

    test("if-then newline-else newline", () => {
      const src = `if true\n 123 else\n 456`;
      evalTestCase(src);
    });

    test("block", () => {
      const src = `{ 123 }`;
      evalTestCase(src);
    });

    test("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
      evalTestCase(src);
    });

    test("for loop newline", () => {
      const src = `for x in [1, 2, 3]\n x`;
      evalTestCase(src);
    });

    test("while loop", () => {
      const src = `while true: 123`;
      evalTestCase(src);
    });

    test("while loop break", () => {
      const src = `while true: break _`;
      evalTestCase(src);
    });

    test("while loop break value", () => {
      const src = `while true: break 1`;
      evalTestCase(src);
    });

    test("while loop continue", () => {
      const src = `while true: continue _`;
      evalTestCase(src);
    });

    test("while loop continue value", () => {
      const src = `while true: continue 1`;
      evalTestCase(src);
    });

    test("labeled expression", () => {
      const src = `label: 123`;
      evalTestCase(src);
    });

    test("return", () => {
      const src = `() -> { return 123 }`;
      evalTestCase(src);
    });

    test("block variable declaration", () => {
      const src = `{ x := 123 }`;
      evalTestCase(src);
    });

    test("block mutable variable declaration", () => {
      const src = `{ mut x := 123 }`;
      evalTestCase(src);
    });

    test("block variable assignment", () => {
      const src = `{ x = 123 }`;
      evalTestCase(src);
    });

    test("block pattern matching", () => {
      const src = `{ x, y = 123, 456 }`;
      evalTestCase(src);
    });
  });

  describe("concurrent programming", () => {
    test("channel send", () => {
      const src = `c <- 123`;
      evalTestCase(src);
    });

    test("channel receive", () => {
      const src = `<- c`;
      evalTestCase(src);
    });

    test("parallel value", () => {
      const src = `123 | 456`;
      evalTestCase(src);
    });

    test("parallel with channels", () => {
      const src = `c <- 123 | <- c`;
      evalTestCase(src);
    });

    test("async", () => {
      const src = `async f x`;
      evalTestCase(src);
    });

    test("await async", () => {
      const src = `await async f x`;
      evalTestCase(src);
    });

    test("await", () => {
      const src = `await x + 1`;
      evalTestCase(src);
    });

    test("yield", () => {
      const src = `yield 123`;
      evalTestCase(src);
    });
  });

  describe("data structures", () => {
    test("unit", () => {
      const src = `()`;
      evalTestCase(src);
    });

    test("symbol", () => {
      const src = `symbol`;
      evalTestCase(src);
    });

    test("channel", () => {
      const src = `channel`;
      evalTestCase(src);
    });

    test("atom (global symbol)", () => {
      const src = `:atom`;
      evalTestCase(src);
    });

    test("tuple", () => {
      const src = `1, 2`;
      evalTestCase(src);
    });

    test("record", () => {
      const src = `a: 1, b: 2`;
      evalTestCase(src);
    });

    test("set", () => {
      const src = `set (1, 2)`;
      evalTestCase(src);
    });

    test("map", () => {
      const src = `[1]: 2, [3]: 4`;
      evalTestCase(src);
    });

    test("map without braces", () => {
      const src = `1+2: 3, 4+5: 6`;
      evalTestCase(src);
    });

    test("field access static", () => {
      const src = `x.y`;
      evalTestCase(src);
    });

    test("field access dynamic", () => {
      const src = `x[y]`;
      evalTestCase(src);
    });
  });

  describe.todo("types", () => {
    describe("primitives", () => {
      test("number", () => {
        const src = `number`;
        evalTestCase(src);
      });

      test("int", () => {
        const src = `int`;
        evalTestCase(src);
      });

      test("float", () => {
        const src = `float`;
        evalTestCase(src);
      });

      test("string", () => {
        const src = `string`;
        evalTestCase(src);
      });

      test("char", () => {
        const src = `char`;
        evalTestCase(src);
      });

      test("boolean", () => {
        const src = `boolean`;
        evalTestCase(src);
      });

      test("unit", () => {
        const src = `unit`;
        evalTestCase(src);
      });

      test("unknown", () => {
        const src = `unknown`;
        evalTestCase(src);
      });

      test("void", () => {
        const src = `void`;
        evalTestCase(src);
      });

      test("type", () => {
        const src = `type`;
        evalTestCase(src);
      });

      test("type with order", () => {
        const src = `type[1]`;
        evalTestCase(src);
      });

      test("value type", () => {
        const src = `value 1`;
        evalTestCase(src);
      });
    });

    describe("algebraic types", () => {
      test("record", () => {
        const src = `(a: number; b: string)`;
        evalTestCase(src);
      });

      test("map", () => {
        const src = `([number]: string)`;
        evalTestCase(src);
      });

      test("map with key dependency", () => {
        const src = `([x: number]: (x, string))`;
        evalTestCase(src);
      });

      test("tuple", () => {
        const src = `number, string`;
        evalTestCase(src);
      });

      test("type key access", () => {
        const src = `type[number]`;
        evalTestCase(src);
      });

      test("type key access static", () => {
        const src = `type.key`;
        evalTestCase(src);
      });

      test("discriminated union from record type", () => {
        const src = `enum (a: number; b: string)`;
        evalTestCase(src);
      });

      test("discriminated by order union from tuple", () => {
        const src = `enum (number, string)`;
        evalTestCase(src);
      });
    });

    describe("set-theoretic types", () => {
      test("negated type", () => {
        const src = `!number`;
        evalTestCase(src);
      });

      test("type intersection", () => {
        const src = `number and string`;
        evalTestCase(src);
      });

      test("type union", () => {
        const src = `number or string`;
        evalTestCase(src);
      });
    });

    describe("functions", () => {
      test("function type", () => {
        const src = `number -> string`;
        evalTestCase(src);
      });

      test("function type with multiple args", () => {
        const src = `fn number, string -> string`;
        evalTestCase(src);
      });

      test("function type with named args", () => {
        const src = `fn x: number, y: string -> string`;
        evalTestCase(src);
      });

      test("dependent function type", () => {
        const src = `fn x: boolean -> if x: string else number`;
        evalTestCase(src);
      });

      test("parametric function type", () => {
        const src = `fn x: infer y -> y or number`;
        evalTestCase(src);
      });

      test("higher order type", () => {
        const src = `fn t: type -> fn x: t -> t or number`;
        evalTestCase(src);
      });
    });

    test("typeof", () => {
      const src = `typeof x`;
      evalTestCase(src);
    });

    test("type cast", () => {
      const src = `x as number`;
      evalTestCase(src);
    });

    test("type coalesce", () => {
      const src = `x :> number`;
      evalTestCase(src);
    });

    test("subtyping check", () => {
      const src = `my_type <= number`;
      evalTestCase(src);
    });
  });

  describe("signals", () => {
    test("value", () => {
      const src = `signal 123`;
      evalTestCase(src);
    });

    test("derived", () => {
      const src = `signal (x + y)`;
      evalTestCase(src);
    });
  });
});
