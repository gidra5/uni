import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { infixArithmeticOps, infixBooleanOps, prefixArithmeticOps, scopeDictionary } from "../../src/parser/constants";
import { group, infix, name, placeholder, prefix, string } from "../../src/parser/ast";
import { matchSeparators } from "../../src/parser/utils";
import { exampleTestCase, treeTestCase, treeTestCaseArgs } from "./utils";
import { pick } from "../../src/utils";

/* one test per example of a language construct  */

describe("comments", () => {
  test("comment", () => {
    const src = `// comment\n123`;
    treeTestCase(src, null, pick(scopeDictionary, ["comment"]));
  });

  test("comment block", () => {
    const src = `/* comment block */123`;
    treeTestCase(src, null, pick(scopeDictionary, ["commentBlock"]));
  });
});

describe("expressions", () => {
  describe("values", () => {
    test("integer", () => {
      const src = `123`;
      treeTestCase(src);
    });

    test("float", () => {
      const src = `123.456`;
      treeTestCase(src);
    });

    test("string", () => {
      const src = `"string"`;
      treeTestCase(src);
    });

    test("true", () => {
      const src = `true`;
      treeTestCase(src, null, pick(scopeDictionary, ["true"]));
    });

    test("false", () => {
      const src = `false`;
      treeTestCase(src, null, pick(scopeDictionary, ["false"]));
    });
  });

  describe("fixity expressions", () => {
    test("name", () => {
      const src = `name`;
      treeTestCase(src);
    });

    test.todo("operator", () => {
      const src = `+`;
    });

    test("group", () => {
      const src = `(1)`;
      treeTestCase(src, null, pick(scopeDictionary, ["parens"]));
    });

    test("prefix", () => {
      const src = `-123`;
      treeTestCase(src, null, pick(scopeDictionary, ["negate"]));
    });

    test("postfix", () => {
      const src = `123--`;
      treeTestCase(src, null, pick(scopeDictionary, ["postfixDecrement"]));
    });

    test("infix", () => {
      const src = `123+456`;
      treeTestCase(src, null, pick(scopeDictionary, ["+"]));
    });

    test("mixfix", () => {
      const src = `123 < 456 < 789`;
      treeTestCase(src, null, pick(scopeDictionary, ["inRange_<_<"]));
    });
  });

  describe("arithmetics", () => {
    for (const [opName, op] of infixArithmeticOps) {
      test(opName, () => {
        const src = `123 ${op} 456`;
        treeTestCase(src, null, pick(scopeDictionary, [op]));
      });
    }

    for (const [opName, op] of prefixArithmeticOps) {
      test(opName, () => {
        const src = `${op}123`;
        treeTestCase(src);
      });
    }

    test("postfix decrement", () => {
      const src = `123--`;
      treeTestCase(src, null, pick(scopeDictionary, ["postfixDecrement"]));
    });

    test("postfix increment", () => {
      const src = `123++`;
      treeTestCase(src, null, pick(scopeDictionary, ["postfixIncrement"]));
    });

    it(...treeTestCaseArgs("1 + 2^3 * 4", null, pick(scopeDictionary, ["+", "*", "^"])));
    it(...treeTestCaseArgs("-(a+b)", null, pick(scopeDictionary, ["negate", "+", "parens"])));

    it(...treeTestCaseArgs("(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1"));
  });

  describe("boolean expressions", () => {
    for (const [opName, op] of infixBooleanOps) {
      test(opName, () => {
        const src = `123 ${op} 456`;
        treeTestCase(src, null, pick(scopeDictionary, [op]));
      });
    }

    test("not", () => {
      const src = `!123`;
      treeTestCase(src, null, pick(scopeDictionary, ["!"]));
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
          treeTestCase(src, null, pick(scopeDictionary, [op]));
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) => Iterator.iter(pair).power(2))) {
        test(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
          treeTestCase(src, null, pick(scopeDictionary, [`inRange_${op1}_${op2}`]));
        });
      }
    });
  });

  describe("function expressions", () => {
    test("function multiple params", () => {
      const src = `fn x, y -> x + y`;
      treeTestCase(src);
    });

    test("function", () => {
      const src = `x -> x`;
      treeTestCase(src);
    });

    test("function with placeholder arg", () => {
      const src = `_ -> #0`;
      treeTestCase(src, null, pick(scopeDictionary, ["->", "#"]));
    });

    test("function with no arg", () => {
      const src = `fn -> #0`;
      treeTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    test("function with shadowed name access", () => {
      const src = `fn a -> fn a -> #a`;
      treeTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    test("function with deep shadowed name access", () => {
      const src = `fn a -> fn a -> fn a -> ##a`;
      treeTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    describe("application", () => {
      test("function call", () => {
        const src = `f x`;
        treeTestCase(src, null, pick(scopeDictionary, ["application"]));
      });

      test("function call multiple args", () => {
        const src = `f x y`;
        treeTestCase(src, null, pick(scopeDictionary, ["application"]));
      });

      test("function call placeholder arg", () => {
        const src = `f _ y`;
        treeTestCase(src, null, pick(scopeDictionary, ["application"]));
      });

      test("function call placeholder args", () => {
        const src = `f _ y _`;
        treeTestCase(src, null, pick(scopeDictionary, ["application"]));
      });

      it(
        ...treeTestCaseArgs("send((1+2), 3)", null, {
          send: {
            separators: matchSeparators(["send"]),
            precedence: [null, Infinity],
          },
          ...pick(scopeDictionary, ["+", "parens", ","]),
        })
      );

      it(...treeTestCaseArgs("send(2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("(send)(2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("(send 1)(2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("(send 1 2)(2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("send 1 + 2", null, pick(scopeDictionary, ["application", "+"])));
      it(...treeTestCaseArgs("send 1 (2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("send a (2, 3)", null, pick(scopeDictionary, ["application", "parens", ","])));
      it(...treeTestCaseArgs("a + send (2, 3)", null, pick(scopeDictionary, ["application", "+", "parens", ","])));
      it(...treeTestCaseArgs("a + send 1 + 2", null, pick(scopeDictionary, ["application", "+", ","])));
    });
  });

  describe("pattern matching", () => {
    test("match", () => {
      const src = `match x { 1 -> 2; 3 -> 4 }`;
      treeTestCase(src);
    });

    test("match that accepts tuple", () => {
      const src = `match x: ((1 -> 2), (3 -> 4))`;
      treeTestCase(src);
    });

    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
      treeTestCase(src);
    });

    test("pattern union", () => {
      const src = `match a {
        (record { x, y } or record { y, z }) -> y
      }`;
      treeTestCase(src);
    });

    test("pattern intersection", () => {
      const src = `match a {
        (record { x, y } and record { z }) -> x + y + z
      }`;
      treeTestCase(src);
    });

    test("arrow function pattern union", () => {
      const src = `(record { x, y } or record { y, z }) -> y`;
      treeTestCase(src);
    });

    test("with 'is' operator", () => {
      const src = `x is (a, b)`;
      treeTestCase(src);
    });

    test("with placeholder", () => {
      const src = `x is (_, b)`;
      treeTestCase(src);
    });

    test("with variable value", () => {
      const src = `x is (^a, b)`;
      treeTestCase(src);
    });

    test("with rest value", () => {
      const src = `x is (a, ...b)`;
      treeTestCase(src);
    });

    test("with rest value first", () => {
      const src = `x is (...b, a)`;
      treeTestCase(src);
    });

    test("with default value", () => {
      const src = `x is ((b = 4), a)`;
      treeTestCase(src);
    });

    test("with rename", () => {
      const src = `x is record { b @ a }`;
      treeTestCase(src);
    });

    test("with name for match", () => {
      const src = `x is ((a, b) @ c)`;
      treeTestCase(src);
    });

    test.todo("with type", () => {
      const src = `x is ((b: number), a)`;
      treeTestCase(src);
    });

    test("binding visible in scope where it is true", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeTestCase(src);
    });
  });

  describe("structured programming", () => {
    test("if-then", () => {
      const src = `if true: 123`;
      treeTestCase(src);
    });

    test("if-then newline", () => {
      const src = `if true\n 123`;
      treeTestCase(src);
    });

    test("if-then-else", () => {
      const src = `if true: 123 else 456`;
      treeTestCase(src);
    });

    test("if-then-elseif-then-else", () => {
      const src = `if true: 123 else if false: 789 else 456`;
      treeTestCase(src);
    });

    test("if-then newline-else", () => {
      const src = `if true\n 123 else 456`;
      treeTestCase(src);
    });

    test("if-then newline-else newline", () => {
      const src = `if true\n 123 else\n 456`;
      treeTestCase(src);
    });

    test("block", () => {
      const src = `{ 123 }`;
      treeTestCase(src);
    });

    test("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
      treeTestCase(src);
    });

    test("for loop newline", () => {
      const src = `for x in [1, 2, 3]\n x`;
      treeTestCase(src);
    });

    test("while loop", () => {
      const src = `while true: 123`;
      treeTestCase(src);
    });

    test("while loop break", () => {
      const src = `while true: break _`;
      treeTestCase(src);
    });

    test("while loop break value", () => {
      const src = `while true: break 1`;
      treeTestCase(src);
    });

    test("while loop continue", () => {
      const src = `while true: continue _`;
      treeTestCase(src);
    });

    test("while loop continue value", () => {
      const src = `while true: continue 1`;
      treeTestCase(src);
    });

    test("labeled expression", () => {
      const src = `label: 123`;
      treeTestCase(src);
    });

    test("return", () => {
      const src = `() -> { return 123 }`;
      treeTestCase(src);
    });

    test("block variable declaration", () => {
      const src = `{ x := 123 }`;
      treeTestCase(src);
    });

    test("block mutable variable declaration", () => {
      const src = `{ mut x := 123 }`;
      treeTestCase(src);
    });

    test("block variable assignment", () => {
      const src = `{ x = 123 }`;
      treeTestCase(src);
    });

    test("block pattern matching", () => {
      const src = `{ x, y = 123, 456 }`;
      treeTestCase(src);
    });
  });

  describe("data structures", () => {
    it(...treeTestCaseArgs("(-(2+7)/A,j, i, 127.0 )"));

    test("unit", () => {
      const src = `()`;
      treeTestCase(src);
    });

    test("symbol", () => {
      const src = `symbol`;
      treeTestCase(src);
    });

    test("channel", () => {
      const src = `channel`;
      treeTestCase(src);
    });

    test("atom (global symbol)", () => {
      const src = `:atom`;
      treeTestCase(src);
    });

    test("tuple", () => {
      const src = `1, 2`;
      treeTestCase(src);
    });

    test("record", () => {
      const src = `a: 1; b: 2`;
      treeTestCase(src);
    });

    test("set", () => {
      const src = `set (1, 2)`;
      treeTestCase(src);
    });

    test("map", () => {
      const src = `[1]: 2; [3]: 4`;
      treeTestCase(src);
    });

    test("map without braces", () => {
      const src = `1+2: 3, 4+5: 6`;
      treeTestCase(src);
    });

    test("field access static", () => {
      const src = `x.y`;
      treeTestCase(src);
    });

    test("field access dynamic", () => {
      const src = `x[y]`;
      treeTestCase(src);
    });
  });

  describe.todo("types", () => {
    describe("primitives", () => {
      test("number", () => {
        const src = `number`;
        treeTestCase(src);
      });

      test("int", () => {
        const src = `int`;
        treeTestCase(src);
      });

      test("float", () => {
        const src = `float`;
        treeTestCase(src);
      });

      test("string", () => {
        const src = `string`;
        treeTestCase(src);
      });

      test("char", () => {
        const src = `char`;
        treeTestCase(src);
      });

      test("boolean", () => {
        const src = `boolean`;
        treeTestCase(src);
      });

      test("unit", () => {
        const src = `unit`;
        treeTestCase(src);
      });

      test("unknown", () => {
        const src = `unknown`;
        treeTestCase(src);
      });

      test("void", () => {
        const src = `void`;
        treeTestCase(src);
      });

      test("type", () => {
        const src = `type`;
        treeTestCase(src);
      });

      test("type with order", () => {
        const src = `type[1]`;
        treeTestCase(src);
      });

      test("value type", () => {
        const src = `value 1`;
        treeTestCase(src);
      });
    });

    describe("composite", () => {
      test("record", () => {
        const src = `record { a: number; b: string }`;
        treeTestCase(src);
      });

      test("set", () => {
        const src = `set number`;
        treeTestCase(src);
      });

      test("map", () => {
        const src = `map (number, string)`;
        treeTestCase(src);
      });

      test("tuple", () => {
        const src = `number, string`;
        treeTestCase(src);
      });
    });

    test("typeof", () => {
      const src = `typeof x`;
      treeTestCase(src);
    });

    describe("set-theoretic types", () => {
      test("negated type", () => {
        const src = `!number`;
        treeTestCase(src);
      });

      test("type intersection", () => {
        const src = `number and string`;
        treeTestCase(src);
      });

      test("type union", () => {
        const src = `number or string`;
        treeTestCase(src);
      });
    });

    test("discriminated union from record type", () => {
      const src = `union (record { a: number; b: string })`;
      treeTestCase(src);
    });

    test("discriminated by order union from tuple", () => {
      const src = `union (number, string)`;
      treeTestCase(src);
    });

    describe("functions", () => {
      test("function type", () => {
        const src = `number -> string`;
        treeTestCase(src);
      });

      test("function type with multiple args", () => {
        const src = `fn number, string -> string`;
        treeTestCase(src);
      });

      test("function type with named args", () => {
        const src = `fn x: number, y: string -> string`;
        treeTestCase(src);
      });

      test("dependent function type", () => {
        const src = `fn x: boolean -> if x: string else number`;
        treeTestCase(src);
      });

      test("parametric function type", () => {
        const src = `fn x: infer y -> y or number`;
        treeTestCase(src);
      });

      test("higher order type", () => {
        const src = `fn t: type -> fn x: t -> t or number`;
        treeTestCase(src);
      });
    });

    test("type cast", () => {
      const src = `x as number`;
      treeTestCase(src);
    });

    test("type coalesce", () => {
      const src = `x :> number`;
      treeTestCase(src);
    });

    test("subtyping check", () => {
      const src = `my_type < number`;
      treeTestCase(src);
    });
  });

  describe("signals", () => {
    test("value", () => {
      const src = `signal 123`;
      treeTestCase(src);
    });

    test("derived", () => {
      const src = `signal (x + y)`;
      treeTestCase(src);
    });
  });
});

describe("programs", () => {
  describe("script", () => {
    test("use", () => {
      const src = `use "a" as b`;
      treeTestCase(src);
    });
    test("use with", () => {
      const src = `use "a" as b with x`;
      treeTestCase(src);
    });
    test("export", () => {
      const src = `export x`;
      treeTestCase(src);
    });
    test("export as", () => {
      const src = `export x as y`;
      treeTestCase(src);
    });

    test("variable use", () => {
      const src = `x := 123;  use "a" as b`;
      treeTestCase(src);
    });
    test("variable use with", () => {
      const src = `x := 123;  use "a" as b with x`;
      treeTestCase(src);
    });
    test("variable export", () => {
      const src = `x := 123; export x`;
      treeTestCase(src);
    });
    test("variable export as", () => {
      const src = `x := 123; export x as y`;
      treeTestCase(src);
    });
  });

  describe("module", () => {
    test("import", () => {
      const src = `import "a" as b`;
      treeTestCase(src);
    });
    test("import with", () => {
      const src = `import "a" as b with c`;
      treeTestCase(src);
    });
    test("import with external", () => {
      const src = `import "a" as b with external c`;
      treeTestCase(src);
    });
    test("external", () => {
      const src = `external y`;
      treeTestCase(src);
    });
    test("private declare", () => {
      const src = `z := y+1`;
      treeTestCase(src);
    });
    test("public declare", () => {
      const src = `export x := z+123`;
      treeTestCase(src);
    });
    test("export main", () => {
      const src = `export args -> {}`;
      treeTestCase(src);
    });
    test("operator", () => {
      const src = `operator _+_ := fn x, y -> x + y`;
      treeTestCase(src);
    });
    test("operator with precedence", () => {
      const src = `operator _+_ precedence 1 := fn x, y -> x + y`;
      treeTestCase(src);
    });
    test("operator with tuple precedence", () => {
      const src = `operator _+_ precedence 1, 2 := fn x, y -> x + y`;
      treeTestCase(src);
    });
  });
});

describe("newline handling", () => {
  test("block newline in the middle", () => {
    const src = `{ a := 1\n b := 2 }`;
    treeTestCase(src);
  });

  test("block newline at the end", () => {
    const src = `{ a := 1\n b := 2\n }`;
    treeTestCase(src);
  });

  test("block newline at the beginning", () => {
    const src = `{\n a := 1\n b := 2 }`;
    treeTestCase(src);
  });

  test("block semicolon newline", () => {
    const src = `{ a := 1;\n b := 2 }`;
    treeTestCase(src);
  });

  test("block semicolon newline at the end", () => {
    const src = `{ a := 1;\n b := 2;\n }`;
    treeTestCase(src);
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
