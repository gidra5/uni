import { beforeEach, describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";

import { parseTokenGroups } from "../src/parser/tokenGroups.ts";
import { parseScript } from "../src/parser/parser.ts";
import { Injectable, register } from "../src/utils/injector.ts";
import { Tree } from "../src/ast.ts";
import { FileMap } from "codespan-napi";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.ASTNodePrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
});

function clearIds(ast: Tree) {
  if (ast.children.length > 0) {
    ast.children.forEach(clearIds);
  }
  delete (ast as any).id;
  return ast;
}

const testCase = (input: string) => {
  const tokens = parseTokenGroups(input);
  const ast = parseScript(tokens);

  expect(clearIds(ast)).toMatchSnapshot();
};

describe("advent of code 1 single file", () => {
  it("variable", () =>
    testCase(`
      // https://adventofcode.com/2023/day/1

      /* take first and last digit on line, concat into two-digit number
        * and sum all numbers in document
        */
      document := """
        1abc2
        pqr3stu8vwx
        a1b2c3d4e5f
        treb7uchet
      """
    `));

  it("split lines", () =>
    testCase(`
        lines := {
          lines := split document "\\n"
          lines = map lines (replace "\\w+" "")
          lines = filter lines fn line: line != ""
        }
      `));

  it.skip("parse numbers", () =>
    testCase(`
        numbers := flat_map lines fn line {
          digits := ()
  
          while line != "" {
            if (char_at line 0).match "\d" {
              digit := number(char_at line 0)
              if !digits[0]: digits[0] = digit
              digits[1] = digit
            }
            (_, ...line) = line
          }
  
          digits[0], digits[1] * 10
        }
      `));

  it("fn multiple args", () => testCase(`fn acc, item -> ()`));

  it("flat map list reducer", () => testCase(`fn acc, item -> (...acc, ...mapper item)`));

  it("flat map list impl", () =>
    testCase(`
        flat_map := fn list, mapper {
          reduce list (fn acc, item -> (...acc, ...mapper item)) (fn first, second -> (...first, ...second)) ()
        }
      `));

  it.skip("reduce list", () =>
    testCase(`
        reduce := fn list, reducer, merge, initial {
          len := length list
          if len == 0: return initial
        
          midpoint := floor(len / 2)
          item := list[midpoint]
          first, second := all(
            | (reduce slice(list, 0, midpoint) reducer merge initial)
            | (reduce slice(list, midpoint + 1) reducer merge initial)
          )
        
          merge (reducer first item) second
        }
      `));
});

/* one test per example of a language construct  */

describe("expressions", () => {
  describe("values", () => {
    it("integer", () => testCase(`123`));
    it("float", () => testCase(`123.456`));
    it("string", () => testCase(`"string"`));
    it("string template", () => testCase(`"string \\(1) string"`));
    it("atom", () => testCase(`$atom`));
  });

  describe("arithmetics", () => {
    it("order of application", () => testCase(`1 + 2^-3 * 4 - 5 / 6 % 7`));
    it("-(a+b)", () => testCase(`-(a+b)`));

    it("complex", () => testCase(`(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1`));
  });

  describe("boolean expressions", () => {
    it("not", () => testCase(`!123`));
    it('"and", "or" and "not" associativity', () => testCase(`a and b and c or d or !e and f and g or not h or i`));
    it("in operator", () => testCase(`$key in x and y`));
    it.todo("ranges 1", () => testCase(`123 < 456 < 789`));
  });

  describe("function expressions", () => {
    it("function block body", () => testCase(`fn x, y { x + y }`));
    it("function multiple params", () => testCase(`fn x, y -> x + y`));
    it("fn no parameters", () => testCase(`fn -> 123`));
    it("fn no parameters block", () => testCase(`fn { 123 }`));
    it("arrow function", () => testCase(`x -> x`));
    it("fn increment", () => testCase(`fn -> line_handled_count++`));
    it.todo("function with return type", () => `fn x, y -> type { x + y }`);
    it.todo("function with placeholder arg", () => `_ -> #0`);
    it.todo("function with no arg", () => `fn -> #0`);
    it.todo("function with shadowed name access", () => `fn a -> fn a -> #a`);
    it.todo("function with deep shadowed name access", () => `fn a -> fn a -> fn a -> ##a`);

    describe("application", () => {
      it("function call", () => testCase(`f x`));
      it("function call multiple args", () => testCase(`f x y`));
      it("function call param with field", () => testCase(`f x.y`));
      it("send((1+2), 3)", () => testCase(`send((1+2), 3)`));
      it("send(2, 3)", () => testCase(`send(2, 3)`));
      it("(send)(2, 3)", () => testCase(`(send)(2, 3)`));
      it("(send 1)(2, 3)", () => testCase(`(send 1)(2, 3)`));
      it("(send 1 2)(2, 3)", () => testCase(`(send 1 2)(2, 3)`));
      it("send 1 + 2", () => testCase(`send 1 + 2`));
      it("a + send (2, 3)", () => testCase(`a + send (2, 3)`));
      it("send a (2, 3)", () => testCase(`send a (2, 3)`));
      it("send 1 (2, 3)", () => testCase(`send 1 (2, 3)`));
      it("a + send 1 + 2", () => testCase(`a + send 1 + 2`));
      it("a + send (2, 3)", () => testCase(`a + send (2, 3)`));
      it("methods chaining", () => testCase(`math.floor(1).multiply(2)`));
      it("function as last arg", () => testCase(`open "file" file -> write file "yolo"`));
      it("block as last arg", () => testCase(`open "file" { write "yolo" }`));
      it("pipe", () => testCase(`1 |> fn x { x + 1 } |> fn y { y * 2 }`));
    });

    describe("delimited application", () => {
      it.todo("delimited args", () => testCase(`f(x, y)`));
      it.todo("named args", () => testCase(`f(x: 1, 3, y: 2)`));
      it.todo("placeholder arg", () => testCase(`f(_, y)`));
      it.todo("placeholder args", () => testCase(`f(_, y, _)`));
      it.todo("spread args", () => testCase(`f(...x, y)`));
    });

    describe("function forms", () => {
      it("immediate form", () => testCase(`fn: x; y`));
      it("block form", () => testCase(`fn { x }`));
      it("rest form", () => testCase(`fn -> x; y`));
    });
  });

  describe("structured programming", () => {
    it("complex 1", () =>
      testCase(`
        y := {
          x := 25
          loop if x < 0: break x else {
            y := x
            x = x - 1
            if y == 19: continue 69
            y
          }
        }
      `));

    it("if-then", () => testCase(`if true: 123`));
    it("if-then-else", () => testCase(`if true: 123 else 456`));
    it("if-then-elseif-then-else", () => testCase(`if true: 123 else if false: 789 else 456`));
    it("sequence", () => testCase(`123; 234; 345; 456`));
    it("block sequence", () => testCase(`{ 123; 234; 345; 456 }`));
    it("parens sequence", () => testCase(`(123; 234; 345; 456)`));
    it("block", () => testCase(`{ 123 }`));
    it("for loop", () => testCase(`for x in (1, 2, 3): x`));
    it("while loop", () => testCase(`while true: 123`));
    it("loop", () => testCase(`loop 123`));
    it("loop scope", () => testCase(`loop { x }`));
    it("labeled expression", () => testCase(`label::123`));
    it("semicolon at the end", () => testCase(`1;`));
    it("increment", () => testCase(`++x`));
    it("post increment", () => testCase(`x++`));

    describe("statement forms", () => {
      it("immediate form", () => testCase(`if true: 123; 456`));
      it("block form", () => testCase(`if true { 123 }`));
      it("rest form", () => testCase(`if true -> 123; 456`));
    });
  });

  describe("concurrent programming", () => {
    it("channel send", () => testCase(`c <- 123`));
    it("channel receive", () => testCase(`<- c`));
    it("channel try send", () => testCase(`c <-? 123`));
    it("channel try receive", () => testCase(`<-? c`));
    it("try receive with assignment", () => testCase(`status := <-?numbers`));
    it("superposition value", () => testCase(`123 & 456`));
    it("parallel value", () => testCase(`123 | 456`));
    it("prefix parallel with code after", () => testCase(`| { };numbers := channel()`));
    it("parallel with channels", () => testCase(`c <- 123 | <- c`));
    it("select channels", () => testCase(`c1 + c2`));
    it("async", () => testCase(`async f x`));
    it("async index", () => testCase(`async f.a`));
    it("await async", () => testCase(`await async f x`));
    it("await", () => testCase(`await x + 1`));
  });

  describe("data structures", () => {
    it("unit", () => testCase(`()`));
    it("tuple", () => testCase(`list, reducer, merge, initial`));
    it.todo("record single", () => testCase(`record { a: 1 }`));
    it.todo("record", () => testCase(`record { a: 1, b: 2 }`));
    it("(-(2+7)/A,j, i, 127.0 )", () => testCase(`(-(2+7)/A,j, i, 127.0 )`));
    it.todo("dictionary", () => testCase(`dict { [1]: 2, [3]: 4 }`));
    it("period operator", () => testCase(`math.floor`));
    it("index", () => testCase(`x[0]`));
    it.skip("field assignment", () => testCase(`x.y = 123`));
    it("field assignment dynamic", () => testCase(`x[y] = 123`));
  });

  describe("effect handlers", () => {
    it.skip("inject", () => testCase(`inject record { a: 1, b: 2 } { 1 }`));
    it("mask", () => testCase(`mask $a, $b { 1 }`));
    it("without", () => testCase(`without $a, $b { 1 }`));
    it.skip("complex", () =>
      testCase(`
        inject record { a: 1, b: 2 } ->
        { a, b } := handlers
         
        inject record { a: a+1, b: b+2 } ->
        mask $a ->
        without $b ->

        { a } := handlers
        a + 1
      `));
  });
});

describe("pattern matching", () => {
  it("match", () => testCase(`match a { 1 -> 2; 2 -> 3; _ -> 4 }`));

  it("in function parameters", () => testCase(`(x, y) -> x + y`));
  it("declare record pattern", () => testCase(`{ a, b } := handlers`));
  it("with 'is' operator", () => testCase(`x is (a, b)`));
  it("with placeholder", () => testCase(`x is (_, b)`));
  it.skip("with pin", () => testCase(`x is (^a, b)`));
  it.skip("with pin expression", () => testCase(`x is (^(a + b), b)`));
  it("with constant value", () => testCase(`x is (1, b)`));
  it("with rest value", () => testCase(`x is (a, ...b)`));
  it("with rest value first", () => testCase(`x is (...b, a)`));
  it("with record pattern", () => testCase(`x is { a, b }`));
  it.todo("with record pattern rename", () => testCase(`x is { a @ c, b }`));
  it.todo("with record pattern key", () => testCase(`x is { [a + b] @ c, b }`));
  it.todo("with record pattern nested", () => testCase(`x is { a @ (c, d), b }`));
  it("with default value", () => testCase(`x is (b = 4, a)`));
  it("with default value second", () => testCase(`x is (a, b = 4)`));
  it("with default value parens", () => testCase(`x is ((b = 4), a)`));
  it("with record default value", () => testCase(`x is { b = 4, a }`));
  it("with rename", () => testCase(`x is (a @ b, c)`));
  it("with name for match", () => testCase(`x is ((a, b) @ c)`));
  it("with like pattern", () => testCase(`x is like { a, b }`));
  it("with strict pattern", () => testCase(`x is like (a, strict { b })`));
  it.todo("with nested value", () => testCase(`x is a.b and a.b == x`));
  it.todo("with merging nested value", () => testCase(`x is (a.b and a.c) and a.b == x and a.c == x`));
  it.todo("with dynamically nested value", () => testCase(`x is a[b] and a[b] == x`));
  it.todo("with dynamic name", () => testCase(`x is [$a] and [$a] == x`));
  it.todo("with unwrapping", () => testCase(`x is some a`));

  it("binding visible in scope where it is true", () => testCase(`x is (a, b) and a == b + 1`));

  describe("set-theoretic patterns", () => {
    test.todo("pattern union", () => {
      const src = `({ x, y } or { y, z }) -> y`;
      testCase(src);
    });

    test.todo("pattern intersection", () => {
      const src = `({ x, y } and { z }) -> x + y + z`;
      testCase(src);
    });

    test.todo("pattern negation", () => {
      const src = `(not { x, y }) -> x + y + z`;
      testCase(src);
    });
  });

  test.todo("with type", () => testCase(`x is (a: number, b)`));

  test.todo("record pattern with type", () => testCase(`x is { a: number, b }`));
});

describe("types", () => {
  it.todo("declaration with type", () => testCase("x: number := 1"));
  it.todo("typeof", () => testCase("typeof x"));
  it.todo("type cast", () => testCase("x as number"));
  it.todo("type coalesce right", () => testCase("x :> number"));

  describe("functions", () => {
    it.todo("function type", () => testCase('x: number -> string := fn: "1"'));
    it.todo("function type with multiple args", () => testCase('x: fn number, string -> string := fn: "1"'));
    it.todo("function type with named args", () => testCase('x: fn x: number, y: string -> string := fn: "1"'));
    it.todo("parametric function type", () => testCase('x: fn x: infer y -> y or number := fn: "1"'));
  });
});

describe("programs", () => {
  it.todo("export declaration as", () => testCase(`export x as y := 123`));
  it.todo("export expr as", () => testCase(`export x as y`));
  it.todo("external variable", () => testCase(`external y`));

  describe("import descriptor", () => {
    it.todo("import dependency", () => testCase(`import depName`));
    it.todo("import project absolute", () => testCase(`import /path/to/folder`));
    it.todo("import project relative", () => testCase(`import ./relative/path/to/folder`));
    it.todo("import project root", () => testCase(`import /`));
    it.todo("import project file", () => testCase(`import /path/to/file.extension`));
    it.todo("import string file", () => testCase(`import /path/to/"file.extension"`));
    it.todo("import project relative complex", () => testCase(`import ../relative/.././path/to/folder`));
    it.todo("import string folder", () => testCase(`import ../relative/.././path/to/"folder"`));
  });

  it.skip("import", () => testCase(`import a as b`));
  it.todo("import with", () => testCase(`import a as b with x`));

  describe("script", () => {
    it.skip("dynamic import", () => testCase(`b := import a`));
    it.skip("dynamic async import", () => testCase(`b := async import a`));
    it.todo("dynamic import with", () => testCase(`b := import a with x`));
  });

  describe("module", () => {
    it.skip("export declaration", () => testCase(`export x := 123`));
    it.skip("export default", () => testCase(`export fn args -> 1`));
    it.todo("operator", () => testCase(`operator _+_ := fn x, y -> x + y`));
    it.todo("operator with precedence", () => testCase(`operator _+_ precedence 1 := fn x, y -> x + y`));
    it.todo("operator with tuple precedence", () => testCase(`operator _+_ precedence 1, 2 := fn x, y -> x + y`));
  });
});

describe("newline handling", () => {
  it("for loop newline", () => testCase(`for x in 1, 2, 3:\n x`));
  it("parallel parens", () => testCase(`(\n| 1\n| 2\n)`));
  it("parallel", () => testCase(`| 1\n| 2`));
  it("chaining", () => testCase(`a\n.b`));
  it("parens", () => testCase(`(\n1 +\n2\n+ 3\n)`));
  it("no parens", () => testCase(`1 +\n2\n+ 3`));
  it("prefix", () => testCase(`!\na`));
  it("infix-prefix", () => testCase(`b :=\n !\na`));
  it("infix-infix", () => testCase(`b +\nc +\nd`));
  it("if else separate lines", () => testCase(`if a:\n 1\n else\n 2`));
  it("if-then newline", () => testCase(`if true:\n 123`));
  it("if-then newline-else", () => testCase(`if true:\n 123 else 456`));
  it("if-then newline-else newline", () => testCase(`if true:\n 123 else\n 456`));
  it("if-then post newline", () => testCase(`if true: 123\nelse 456`));
  it("if-then post newline block", () => testCase(`if true { 123 }\nelse 456`));
  it("block newline in the middle", () => testCase(`{ a := 1\n b := 2 }`));
  it("block newline at the end", () => testCase(`{ a := 1\n b := 2\n }`));
  it("block newline at the beginning", () => testCase(`{\n a := 1\n b := 2 }`));
  it("block semicolon newline", () => testCase(`{ a := 1;\n b := 2 }`));
  it("block semicolon newline at the end", () => testCase(`{ a := 1;\n b := 2;\n }`));
  it("newline at the end", () => testCase(`1\n`));
  it("semicolon-newline at the end", () => testCase(`1;\n`));
  it("empty switch with newline", () => testCase(`match a { \n }`));
  it.todo("application-newline-increment", () => testCase(`f a\n ++b`));
  it("pipe", () => testCase(`1 \n|> fn x { x + 1 } \n|> fn y { y * 2 }`));
});
