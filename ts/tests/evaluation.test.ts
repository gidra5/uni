import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { infixArithmeticOps, infixBooleanOps, prefixArithmeticOps, scopeDictionary } from "../src/parser/constants";
import { parseExprString } from "../src/parser/string";
import { parseTokens } from "../src/parser/tokens";
import { parse } from "../src/parser";
import { pick, omitASTDataScope } from "../src/utils";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

export const evalTestCase = (src, expectedTree?) => {
  const [tokens] = parseTokens(src);
  const [tree, errors] = parse()(tokens);
  // console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  const _tree = omitASTDataScope(tree);
  if (expectedTree) expect(_tree).toEqual(expectedTree);
  expect(_tree).toMatchSnapshot();
};

export const evalTestCaseArgs = (src, expectedTree?) =>
  [`produces correct tree for '${src}'`, () => evalTestCase(src, expectedTree)] as const;

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
      evalTestCase(src, null, pick(scopeDictionary, ["!"]));
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
          evalTestCase(src, null, pick(scopeDictionary, [op]));
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) => Iterator.iter(pair).power(2))) {
        test(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
          evalTestCase(src, null, pick(scopeDictionary, [`inRange_${op1}_${op2}`]));
        });
      }
    });
  });

  describe("function expressions", () => {
    test("function with no arg", () => {
      const src = `fn -> #0`;
      evalTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    test("function with shadowed name access", () => {
      const src = `fn a -> fn a -> #a`;
      evalTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    test("function with deep shadowed name access", () => {
      const src = `fn a -> fn a -> fn a -> ##a`;
      evalTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    describe("application", () => {
      test("function call", () => {
        const src = `f x`;
        evalTestCase(src, null, pick(scopeDictionary, ["application"]));
      });

      test("function call multiple args", () => {
        const src = `f x y`;
        evalTestCase(src, null, pick(scopeDictionary, ["application"]));
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
    it(...evalTestCaseArgs("(-(2+7)/A,j, i, 127.0 )"));

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

describe("programs", () => {
  describe("script", () => {
    test("use", () => {
      const src = `use "a" as b`;
      evalTestCase(src);
    });
    test("use with", () => {
      const src = `use "a" as b with x`;
      evalTestCase(src);
    });
    test("export", () => {
      const src = `export x`;
      evalTestCase(src);
    });
    test("export as", () => {
      const src = `export x as y`;
      evalTestCase(src);
    });

    test("variable use", () => {
      const src = `x := 123;  use "a" as b`;
      evalTestCase(src);
    });
    test("variable use with", () => {
      const src = `x := 123;  use "a" as b with x`;
      evalTestCase(src);
    });
    test("variable export", () => {
      const src = `x := 123; export x`;
      evalTestCase(src);
    });
    test("variable export as", () => {
      const src = `x := 123; export x as y`;
      evalTestCase(src);
    });
  });

  describe("module", () => {
    test("import", () => {
      const src = `import "a" as b`;
      evalTestCase(src);
    });
    test("import with", () => {
      const src = `import "a" as b with c`;
      evalTestCase(src);
    });
    test("import with external", () => {
      const src = `import "a" as b with external c`;
      evalTestCase(src);
    });
    test("external", () => {
      const src = `external y`;
      evalTestCase(src);
    });
    test("private declare", () => {
      const src = `z := y+1`;
      evalTestCase(src);
    });
    test("public declare", () => {
      const src = `export x := z+123`;
      evalTestCase(src);
    });
    test("export main", () => {
      const src = `export args -> {}`;
      evalTestCase(src);
    });
    test("operator", () => {
      const src = `operator _+_ := fn x, y -> x + y`;
      evalTestCase(src);
    });
    test("operator with precedence", () => {
      const src = `operator _+_ precedence 1 := fn x, y -> x + y`;
      evalTestCase(src);
    });
    test("operator with tuple precedence", () => {
      const src = `operator _+_ precedence 1, 2 := fn x, y -> x + y`;
      evalTestCase(src);
    });
  });
});

describe("newline handling", () => {
  test("block newline in the middle", () => {
    const src = `{ a := 1\n b := 2 }`;
    evalTestCase(src);
  });

  test("block newline at the end", () => {
    const src = `{ a := 1\n b := 2\n }`;
    evalTestCase(src);
  });

  test("block newline at the beginning", () => {
    const src = `{\n a := 1\n b := 2 }`;
    evalTestCase(src);
  });

  test("block semicolon newline", () => {
    const src = `{ a := 1;\n b := 2 }`;
    evalTestCase(src);
  });

  test("block semicolon newline at the end", () => {
    const src = `{ a := 1;\n b := 2;\n }`;
    evalTestCase(src);
  });
});

describe("examples", () => {
  describe("procedural", () => {
    test("hello world", () => {
      const src = `
        external println
        export args -> {
          println "Hello, World!"
        }`;
      exampleTestCase(src);
    });

    test("fibonacci", () => {
      const src = `
        export fib := n -> {
          if n < 2
            1
          else
            fib (n - 1) + fib (n - 2)
        }`;

      exampleTestCase(src);
    });

    test.todo("quick sort recursive", () => {
      const src = `
        export quicksort := xs -> {
          if xs == ()
            return ()
          
          (pivot, ...rest) := xs
          smaller := for x in rest: if x < pivot: x
          bigger := for x in rest: if x >= pivot: x
          return (...quicksort smaller, pivot, ...quicksort bigger)
        }`;

      exampleTestCase(src);
    });

    test.todo("bubble sort imperative", () => {
      const src = `
        export bubblesort := fn mut list -> {
          for i in range 0 list.length
          for j in range 0 (list.length - i - 1)
          if list[j] > list[j+1]
            list[j], list[j+1] = list[j+1], list[j]
          return list
        }`;

      exampleTestCase(src);
    });
  });

  describe.todo("functional", () => {
    test("option", () => {
      const src = `
        export none := fn some, none -> none
        export some := value -> fn some, none -> some value
        export map := fn f, option -> match option {
          none -> none
          some value -> some (f value)
        }
        export unwrap := fn option, default -> match option {
          none -> default
          some value -> value
        }
        export flat_map := fn f, option -> match option {
          none -> none
          some value -> f value
        }
      `;
      exampleTestCase(src);
    });

    test("result", () => {
      const src = `
        export ok := value -> fn ok, err -> ok value
        export err := value -> fn ok, err -> err value
        export map := fn f, result ->
          if result is ok value: ok (f value) else: result
        export unwrap := fn result, default ->
          if result is ok value: value else: default
        export flat_map := fn f, result ->
          if result is ok value: f value else: result
      `;
      exampleTestCase(src);
    });

    test("tuple", () => {
      const src = `
        export tuple := fn x, y -> fn match -> match x y
        export first := fn tuple -> tuple (fn x, y -> x)
        export second := fn tuple -> tuple (fn x, y -> y)
      `;
      exampleTestCase(src);
    });

    test("list", () => {
      const src = `
        symbol EmptyList
        export nil := fn cons, nil -> nil
        export cons := fn x, xs -> fn cons, nil -> cons x xs
        export head := fn list -> list (fn x, xs -> x) EmptyList
        export tail := fn list -> list (fn x, xs -> xs) EmptyList
        export map := fn f, list -> list (fn x, xs -> cons (f x) (map f xs)) nil
      `;
      exampleTestCase(src);
    });

    test.todo("map", () => {
      const src = `
        symbol NotFound
        export empty := fn entry, empty -> empty
        export entry := fn key, value, rest -> fn entry, empty -> entry key value rest
        export find := fn key, map -> map
          (fn _key, value, rest ->
            if key == _key: value else find key rest
          )
          NotFound
        export insert := fn key, value, map -> entry key value (remove key map)
        export remove := fn key, map -> map
          (fn _key, value, rest ->
            if key == _key: rest else remove key rest
          )
          empty
        operator _[_] = fn map, key -> find key map
      `;
      exampleTestCase(src);
    });
  });

  test.todo("prototype", () => {
    const src = `
      symbol Prototype
      operator _._ = fn value, name -> 
        if value[name] is some value: value
        else accessor value[Prototype] name
    `;
    exampleTestCase(src);
  });
});
