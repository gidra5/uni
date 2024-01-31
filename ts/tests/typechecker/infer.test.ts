import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { infixArithmeticOps, prefixArithmeticOps } from "../../src/parser";
import { group, infix, name, placeholder, prefix, string } from "../../src/parser/ast";
import { matchSeparators } from "../../src/parser/utils";
import { exampleInferTestCase, treeInferTestCase, treeInferTestCaseArgs } from "./utils";
import { func, index, type, unknown } from "../../src/typechecker/type";

describe("expressions", () => {
  describe.todo("values", () => {
    test("number", () => {
      const src = `123`;
      treeInferTestCase(src);
    });

    test("string", () => {
      const src = `"string"`;
      treeInferTestCase(src);
    });

    test("true", () => {
      const src = `true`;
      treeInferTestCase(src);
    });

    test("false", () => {
      const src = `false`;
      treeInferTestCase(src);
    });
  });

  describe.todo("fixity expressions", () => {
    test("name", () => {
      const src = `name`;
      treeInferTestCase(src);
    });

    test.todo("operator", () => {
      const src = `+`;
    });

    test("group", () => {
      const src = `(1)`;
      treeInferTestCase(src);
    });

    test("prefix", () => {
      const src = `-123`;
      treeInferTestCase(src);
    });

    test("postfix", () => {
      const src = `123--`;
      treeInferTestCase(src);
    });

    test("infix", () => {
      const src = `123+456`;
      treeInferTestCase(src);
    });

    test("mixfix", () => {
      const src = `123 < 456 < 789`;
      treeInferTestCase(src);
    });
  });

  describe.todo("arithmetics", () => {
    for (const [opName, op] of infixArithmeticOps) {
      test(opName, () => {
        const src = `123 ${op} 456`;
        treeInferTestCase(src);
      });
    }

    for (const [opName, op] of prefixArithmeticOps) {
      test(opName, () => {
        const src = `${op}123`;
        treeInferTestCase(src);
      });
    }

    test("postfix decrement", () => {
      const src = `123--`;
      treeInferTestCase(src);
    });

    test("postfix increment", () => {
      const src = `123++`;
      treeInferTestCase(src);
    });

    it(...treeInferTestCaseArgs("1 + 2^3 * 4"));
    it(...treeInferTestCaseArgs("--i"));
    it(...treeInferTestCaseArgs("++i"));
    it(...treeInferTestCaseArgs("-(a+b)"));

    it(...treeInferTestCaseArgs("(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1"));
  });

  describe.todo("boolean expressions", () => {
    test("in", () => {
      const src = `123 in 456`;
      treeInferTestCase(src);
    });

    test("is", () => {
      const src = `123 is 456`;
      treeInferTestCase(src);
    });

    test("and", () => {
      const src = `123 and 456`;
      treeInferTestCase(src);
    });

    test("or", () => {
      const src = `123 or 456`;
      treeInferTestCase(src);
    });

    test("not", () => {
      const src = `!123`;
      treeInferTestCase(src);
    });

    test("equal", () => {
      const src = `123 == 456`;
      treeInferTestCase(src);
    });

    test("not equal", () => {
      const src = `123 != 456`;
      treeInferTestCase(src);
    });

    test("deep equal", () => {
      const src = `123 === 456`;
      treeInferTestCase(src);
    });

    test("deep not equal", () => {
      const src = `123 !== 456`;
      treeInferTestCase(src);
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
          treeInferTestCase(src);
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) => Iterator.iter(pair).power(2))) {
        test(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
          treeInferTestCase(src);
        });
      }
    });
  });

  describe("function expressions", () => {
    test.todo("function multiple params", () => {
      const src = `fn x y -> x y`;
      treeInferTestCase(
        src,
        func(
          { type: type(), implicit: true },
          { type: type(), implicit: true },
          { name: "x", type: func(index(1), index(0)) },
          { name: "y", type: index(2) },
          index(2)
        )
      );
    });

    test("function", () => {
      const src = `x -> x`;
      treeInferTestCase(src, func({ type: type(), implicit: true }, index(0), index(1)));
    });

    describe.todo("application", () => {
      test("function call", () => {
        const src = `f x`;
        treeInferTestCase(src);
      });

      test("function call multiple args", () => {
        const src = `f x y`;
        treeInferTestCase(src);
      });

      it(
        ...treeInferTestCaseArgs("send((1+2), 3)", undefined, {
          send: {
            separators: matchSeparators(["send"]),
            precedence: [null, Infinity],
          },
        })
      );

      it(...treeInferTestCaseArgs("send(2, 3)"));
      it(...treeInferTestCaseArgs("(send)(2, 3)"));
      it(...treeInferTestCaseArgs("(send 1)(2, 3)"));
      it(...treeInferTestCaseArgs("(send 1 2)(2, 3)"));
      it(...treeInferTestCaseArgs("send 1 + 2"));
      it(...treeInferTestCaseArgs("send 1 (2, 3)"));
      it(...treeInferTestCaseArgs("send a (2, 3)"));
      it(...treeInferTestCaseArgs("a + send (2, 3)"));
      it(...treeInferTestCaseArgs("a + send 1 + 2"));
    });
  });

  describe.todo("pattern matching", () => {
    test("match", () => {
      const src = `match x { 1 -> 2; 3 -> 4 }`;
      treeInferTestCase(src);
    });

    test("match newline inside", () => {
      const src = `match x { 1 -> 2\n 3 -> 4 }`;
      treeInferTestCase(src);
    });

    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
      treeInferTestCase(src);
    });

    test("with 'is' operator", () => {
      const src = `x is (a, b)`;
      treeInferTestCase(src);
    });

    test("with placeholder", () => {
      const src = `x is (_, b)`;
      treeInferTestCase(src);
    });

    test("with variable value", () => {
      const src = `x is (#a, b)`;
      treeInferTestCase(src);
    });

    test("with rest value", () => {
      const src = `x is (a, ...b)`;
      treeInferTestCase(src);
    });

    test("with rest value first", () => {
      const src = `x is (...b, a)`;
      treeInferTestCase(src);
    });

    test("binding visible in scope where it is true", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeInferTestCase(src);
    });
  });

  describe.todo("structured programming", () => {
    test("if-then", () => {
      const src = `if true: 123`;
      treeInferTestCase(src);
    });

    test("if-then newline", () => {
      const src = `if true\n 123`;
      treeInferTestCase(src);
    });

    test("if-then-else", () => {
      const src = `if true: 123 else 456`;
      treeInferTestCase(src);
    });

    test("if-then-elseif-then-else", () => {
      const src = `if true: 123 else if false: 789 else 456`;
      treeInferTestCase(src);
    });

    test("if-then newline-else", () => {
      const src = `if true\n 123 else 456`;
      treeInferTestCase(src);
    });

    test("if-then newline-else newline", () => {
      const src = `if true\n 123 else\n 456`;
      treeInferTestCase(src);
    });

    test("block", () => {
      const src = `{ 123 }`;
      treeInferTestCase(src);
    });

    test("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
      treeInferTestCase(src);
    });

    test("for loop newline", () => {
      const src = `for x in [1, 2, 3]\n x`;
      treeInferTestCase(src);
    });

    test("while loop", () => {
      const src = `while true: 123`;
      treeInferTestCase(src);
    });

    test("while loop break", () => {
      const src = `while true: break _`;
      treeInferTestCase(src);
    });

    test("while loop break value", () => {
      const src = `while true: break 1`;
      treeInferTestCase(src);
    });

    test("while loop continue", () => {
      const src = `while true: continue _`;
      treeInferTestCase(src);
    });

    test("while loop continue value", () => {
      const src = `while true: continue 1`;
      treeInferTestCase(src);
    });

    test("labeled expression", () => {
      const src = `label: 123`;
      treeInferTestCase(src);
    });

    test("expression-label", () => {
      const src = `123+456: 789`;
      treeInferTestCase(src);
    });

    test("return", () => {
      const src = `() -> { return 123 }`;
      treeInferTestCase(src);
    });

    test("block variable declaration", () => {
      const src = `{ x := 123 }`;
      treeInferTestCase(src);
    });

    test("block mutable variable declaration", () => {
      const src = `{ mut x := 123 }`;
      treeInferTestCase(src);
    });

    test("block variable assignment", () => {
      const src = `{ x = 123 }`;
      treeInferTestCase(src);
    });

    test("block pattern matching", () => {
      const src = `{ x, y = 123, 456 }`;
      treeInferTestCase(src);
    });
  });

  describe.todo("data structures", () => {
    it(...treeInferTestCaseArgs("(-(2+7)/A,j, i, 127.0 )"));

    test("unit", () => {
      const src = `()`;
      treeInferTestCase(src);
    });

    test("symbol", () => {
      const src = `symbol x`;
      treeInferTestCase(src);
    });

    test("tuple", () => {
      const src = `1, 2`;
      treeInferTestCase(src);
    });

    test("record", () => {
      const src = `record { a: 1; b: 2 }`;
      treeInferTestCase(src);
    });

    test("set", () => {
      const src = `set { 1; 2 }`;
      treeInferTestCase(src);
    });

    test("map", () => {
      const src = `map { 1: 2; 3: 4 }`;
      treeInferTestCase(src);
    });

    test("field access", () => {
      const src = `x.y`;
      treeInferTestCase(src);
    });

    test("field access dynamic", () => {
      const src = `x[y]`;
      treeInferTestCase(src);
    });
  });
});

describe.todo("programs", () => {
  describe("script", () => {
    test("use", () => {
      const src = `use "a" as b`;
      treeInferTestCase(src);
    });
    test("use with", () => {
      const src = `use "a" as b with x`;
      treeInferTestCase(src);
    });
    test("export", () => {
      const src = `export x`;
      treeInferTestCase(src);
    });
    test("export as", () => {
      const src = `export x as y`;
      treeInferTestCase(src);
    });

    test("variable use", () => {
      const src = `x := 123;  use "a" as b`;
      treeInferTestCase(src);
    });
    test("variable use with", () => {
      const src = `x := 123;  use "a" as b with x`;
      treeInferTestCase(src);
    });
    test("variable export", () => {
      const src = `x := 123; export x`;
      treeInferTestCase(src);
    });
    test("variable export as", () => {
      const src = `x := 123; export x as y`;
      treeInferTestCase(src);
    });
  });

  describe("module", () => {
    test("import", () => {
      const src = `import "a" as b`;
      treeInferTestCase(src);
    });
    test("import with", () => {
      const src = `import "a" as b with c`;
      treeInferTestCase(src);
    });
    test("import with external", () => {
      const src = `import "a" as b with external c`;
      treeInferTestCase(src);
    });
    test("external", () => {
      const src = `external y`;
      treeInferTestCase(src);
    });
    test("private declare", () => {
      const src = `z := y+1`;
      treeInferTestCase(src);
    });
    test("public declare", () => {
      const src = `export x := z+123`;
      treeInferTestCase(src);
    });
    test("export main", () => {
      const src = `export args -> {}`;
      treeInferTestCase(src);
    });
    test("operator", () => {
      const src = `operator _+_ := fn x, y -> x + y`;
      treeInferTestCase(src);
    });
    test("operator with precedence", () => {
      const src = `operator _+_ precedence 1 := fn x, y -> x + y`;
      treeInferTestCase(src);
    });
    test("operator with tuple precedence", () => {
      const src = `operator _+_ precedence 1, 2 := fn x, y -> x + y`;
      treeInferTestCase(src);
    });
  });
});

describe.todo("examples", () => {
  describe("procedural", () => {
    test("hello world", () => {
      const src = `
        external println
        export args -> {
          println "Hello, World!"
        }`;
      exampleInferTestCase(src);
    });

    test("fibonacci", () => {
      const src = `
        export fib := n -> {
          if n < 2
            1
          else
            fib (n - 1) + fib (n - 2)
        }`;

      exampleInferTestCase(src);
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

      exampleInferTestCase(src);
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

      exampleInferTestCase(src);
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
      exampleInferTestCase(src);
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
      exampleInferTestCase(src);
    });

    test("tuple", () => {
      const src = `
        export tuple := fn x, y -> fn match -> match x y
        export first := fn tuple -> tuple (fn x, y -> x)
        export second := fn tuple -> tuple (fn x, y -> y)
      `;
      exampleInferTestCase(src);
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
      exampleInferTestCase(src);
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
      exampleInferTestCase(src);
    });
  });

  test.todo("prototype", () => {
    const src = `
      symbol Prototype
      operator _._ = fn value, name -> 
        if value[name] is some value: value
        else accessor value[Prototype] name
    `;
    exampleInferTestCase(src);
  });
});
