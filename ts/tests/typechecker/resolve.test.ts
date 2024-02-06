import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { exampleScopeTestCase, treeScopeTestCase } from "./utils";

describe("expressions", () => {
  describe("function expressions", () => {
    test("function multiple params", () => {
      const src = `fn x y -> x y`;
      treeScopeTestCase(src);
    });

    test("function", () => {
      const src = `x -> x`;
      treeScopeTestCase(src);
    });

    test("function with placeholder arg", () => {
      const src = `_ -> #0`;
      treeScopeTestCase(src);
    });

    test("function with no arg", () => {
      const src = `fn -> #0`;
      treeScopeTestCase(src);
    });

    test("function with name shadowing", () => {
      const src = `fn a -> fn a -> a`;
      treeScopeTestCase(src);
    });

    test("function with shadowed name access", () => {
      const src = `fn a -> fn a -> #a`;
      treeScopeTestCase(src);
    });

    test("function with deep shadowed name access", () => {
      const src = `fn a -> fn a -> fn a -> ##a`;
      treeScopeTestCase(src);
    });
  });

  describe("pattern matching", () => {
    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
      treeScopeTestCase(src);
    });

    test.todo("with 'is' operator", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("with 'is' operator with equality", () => {
      const src = `x is (a, a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("with placeholder", () => {
      const src = `x is (_, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("with variable value", () => {
      const src = `x is (^a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("with rest value", () => {
      const src = `x is (a, ...b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("with rest value first", () => {
      const src = `x is (...b, a) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test.todo("binding visible in scope where it is true", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });
  });

  describe.todo("structured programming", () => {
    test("if-then", () => {
      const src = `if true: 123`;
      treeScopeTestCase(src);
    });

    test("if-then newline", () => {
      const src = `if true\n 123`;
      treeScopeTestCase(src);
    });

    test("if-then-else", () => {
      const src = `if true: 123 else 456`;
      treeScopeTestCase(src);
    });

    test("if-then-elseif-then-else", () => {
      const src = `if true: 123 else if false: 789 else 456`;
      treeScopeTestCase(src);
    });

    test("if-then newline-else", () => {
      const src = `if true\n 123 else 456`;
      treeScopeTestCase(src);
    });

    test("if-then newline-else newline", () => {
      const src = `if true\n 123 else\n 456`;
      treeScopeTestCase(src);
    });

    test("block", () => {
      const src = `{ 123 }`;
      treeScopeTestCase(src);
    });

    test("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
      treeScopeTestCase(src);
    });

    test("for loop newline", () => {
      const src = `for x in [1, 2, 3]\n x`;
      treeScopeTestCase(src);
    });

    test("while loop", () => {
      const src = `while true: 123`;
      treeScopeTestCase(src);
    });

    test("while loop break", () => {
      const src = `while true: break _`;
      treeScopeTestCase(src);
    });

    test("while loop break value", () => {
      const src = `while true: break 1`;
      treeScopeTestCase(src);
    });

    test("while loop continue", () => {
      const src = `while true: continue _`;
      treeScopeTestCase(src);
    });

    test("while loop continue value", () => {
      const src = `while true: continue 1`;
      treeScopeTestCase(src);
    });

    test("labeled expression", () => {
      const src = `label: 123`;
      treeScopeTestCase(src);
    });

    test("expression-label", () => {
      const src = `123+456: 789`;
      treeScopeTestCase(src);
    });

    test("return", () => {
      const src = `() -> { return 123 }`;
      treeScopeTestCase(src);
    });

    test("block variable declaration", () => {
      const src = `{ x := 123 }`;
      treeScopeTestCase(src);
    });

    test("block mutable variable declaration", () => {
      const src = `{ mut x := 123 }`;
      treeScopeTestCase(src);
    });

    test("block variable assignment", () => {
      const src = `{ x = 123 }`;
      treeScopeTestCase(src);
    });

    test("block pattern matching", () => {
      const src = `{ x, y = 123, 456 }`;
      treeScopeTestCase(src);
    });
  });
});

describe.todo("programs", () => {
  describe("script", () => {
    test("use", () => {
      const src = `use "a" as b`;
      treeScopeTestCase(src);
    });
    test("use with", () => {
      const src = `use "a" as b with x`;
      treeScopeTestCase(src);
    });
    test("export", () => {
      const src = `export x`;
      treeScopeTestCase(src);
    });
    test("export as", () => {
      const src = `export x as y`;
      treeScopeTestCase(src);
    });

    test("variable use", () => {
      const src = `x := 123;  use "a" as b`;
      treeScopeTestCase(src);
    });
    test("variable use with", () => {
      const src = `x := 123;  use "a" as b with x`;
      treeScopeTestCase(src);
    });
    test("variable export", () => {
      const src = `x := 123; export x`;
      treeScopeTestCase(src);
    });
    test("variable export as", () => {
      const src = `x := 123; export x as y`;
      treeScopeTestCase(src);
    });
  });

  describe("module", () => {
    test("import", () => {
      const src = `import "a" as b`;
      treeScopeTestCase(src);
    });
    test("import with", () => {
      const src = `import "a" as b with c`;
      treeScopeTestCase(src);
    });
    test("import with external", () => {
      const src = `import "a" as b with external c`;
      treeScopeTestCase(src);
    });
    test("external", () => {
      const src = `external y`;
      treeScopeTestCase(src);
    });
    test("private declare", () => {
      const src = `z := y+1`;
      treeScopeTestCase(src);
    });
    test("public declare", () => {
      const src = `export x := z+123`;
      treeScopeTestCase(src);
    });
    test("export main", () => {
      const src = `export args -> {}`;
      treeScopeTestCase(src);
    });
    test("operator", () => {
      const src = `operator _+_ := fn x, y -> x + y`;
      treeScopeTestCase(src);
    });
    test("operator with precedence", () => {
      const src = `operator _+_ precedence 1 := fn x, y -> x + y`;
      treeScopeTestCase(src);
    });
    test("operator with tuple precedence", () => {
      const src = `operator _+_ precedence 1, 2 := fn x, y -> x + y`;
      treeScopeTestCase(src);
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
      exampleScopeTestCase(src);
    });

    test("fibonacci", () => {
      const src = `
        export fib := n -> {
          if n < 2
            1
          else
            fib (n - 1) + fib (n - 2)
        }`;

      exampleScopeTestCase(src);
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

      exampleScopeTestCase(src);
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

      exampleScopeTestCase(src);
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
      exampleScopeTestCase(src);
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
      exampleScopeTestCase(src);
    });

    test("tuple", () => {
      const src = `
        export tuple := fn x, y -> fn match -> match x y
        export first := fn tuple -> tuple (fn x, y -> x)
        export second := fn tuple -> tuple (fn x, y -> y)
      `;
      exampleScopeTestCase(src);
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
      exampleScopeTestCase(src);
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
      exampleScopeTestCase(src);
    });
  });

  test.todo("prototype", () => {
    const src = `
      symbol Prototype
      operator _._ = fn value, name -> 
        if value[name] is some value: value
        else accessor value[Prototype] name
    `;
    exampleScopeTestCase(src);
  });
});
