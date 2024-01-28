import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { infixArithmeticOps, prefixArithmeticOps } from "../../src/parser";
import {
  group,
  infix,
  name,
  number,
  prefix,
  string,
} from "../../src/parser/ast";
import { matchSeparators } from "../../src/parser/utils";
import { treeTestCase, treeTestCaseArgs } from "./utils";

describe("comments", () => {
  test("comment", () => {
    const src = `// comment\n123`;
    treeTestCase(src);
  });

  test("comment block", () => {
    const src = `/* comment block */123`;
    treeTestCase(src);
  });
});

describe("expressions", () => {
  describe("values", () => {
    test("number", () => {
      const src = `123`;
      treeTestCase(src);
    });

    test("string", () => {
      const src = `"string"`;
      treeTestCase(src);
    });

    test("true", () => {
      const src = `true`;
      treeTestCase(src);
    });

    test("false", () => {
      const src = `false`;
      treeTestCase(src);
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
      treeTestCase(src);
    });

    test("prefix", () => {
      const src = `-123`;
      treeTestCase(src);
    });

    test("postfix", () => {
      const src = `123--`;
      treeTestCase(src);
    });

    test("infix", () => {
      const src = `123+456`;
      treeTestCase(src);
    });

    test("mixfix", () => {
      const src = `123 < 456 < 789`;
      treeTestCase(src);
    });
  });

  describe("arithmetics", () => {
    for (const [opName, op] of infixArithmeticOps) {
      test(opName, () => {
        const src = `123 ${op} 456`;
        treeTestCase(src);
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
      treeTestCase(src);
    });

    test("postfix increment", () => {
      const src = `123++`;
      treeTestCase(src);
    });

    it(...treeTestCaseArgs("1 + 2^3 * 4"));
    it(...treeTestCaseArgs("--i"));
    it(...treeTestCaseArgs("++i"));
    it(...treeTestCaseArgs("-(a+b)"));

    it(...treeTestCaseArgs("(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1"));
  });

  describe("boolean expressions", () => {
    test("in", () => {
      const src = `123 in 456`;
      treeTestCase(src);
    });

    test("is", () => {
      const src = `123 is 456`;
      treeTestCase(src);
    });

    test("and", () => {
      const src = `123 and 456`;
      treeTestCase(src);
    });

    test("or", () => {
      const src = `123 or 456`;
      treeTestCase(src);
    });

    test("not", () => {
      const src = `not 123`;
      treeTestCase(src);
    });

    test("equal", () => {
      const src = `123 == 456`;
      treeTestCase(src);
    });

    test("not equal", () => {
      const src = `123 != 456`;
      treeTestCase(src);
    });

    test("deep equal", () => {
      const src = `123 === 456`;
      treeTestCase(src);
    });

    test("deep not equal", () => {
      const src = `123 !== 456`;
      treeTestCase(src);
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
          treeTestCase(src);
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) => Iterator.iter(pair).power(2))) {
        test(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
          treeTestCase(src);
        });
      }
    });
  });

  describe("function expressions", () => {
    test("funciton multiple params", () => {
      const src = `fn x y -> x + y`;
      treeTestCase(src);
    });

    test("function", () => {
      const src = `x -> x`;
      treeTestCase(src);
    });

    describe("application", () => {
      test("function call", () => {
        const src = `f x`;
        treeTestCase(src);
      });

      test("function call multiple args", () => {
        const src = `f x y`;
        treeTestCase(src);
      });

      it(
        ...treeTestCaseArgs("send((1+2), 3)", undefined, {
          send: {
            separators: matchSeparators(["send"]),
            precedence: [null, Infinity],
          },
        })
      );

      it(...treeTestCaseArgs("send(2, 3)"));
      it(...treeTestCaseArgs("(send)(2, 3)"));
      it(...treeTestCaseArgs("(send 1)(2, 3)"));
      it(...treeTestCaseArgs("(send 1 2)(2, 3)"));
      it(...treeTestCaseArgs("send 1 + 2"));
      it(...treeTestCaseArgs("send 1 (2, 3)"));
      it(...treeTestCaseArgs("send a (2, 3)"));
      it(...treeTestCaseArgs("a + send (2, 3)"));
      it(...treeTestCaseArgs("a + send 1 + 2"));
    });
  });

  describe("pattern matching", () => {
    test("match", () => {
      const src = `match x { 1 -> 2; 3 -> 4 }`;
      treeTestCase(src);
    });

    test("match newline inside", () => {
      const src = `match x { 1 -> 2\n 3 -> 4 }`;
      treeTestCase(src);
    });

    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
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
      treeTestCase(src, infix(group("label"), name("label"), number(123)));
    });

    test("expression-label", () => {
      const src = `123+456: 789`;
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
      const src = `symbol x`;
      treeTestCase(src);
    });

    test("tuple", () => {
      const src = `1, 2`;
      treeTestCase(src);
    });

    test("list", () => {
      const src = `[1, 2]`;
      treeTestCase(src);
    });

    test("record", () => {
      const src = `record { a: 1, b: 2 }`;
      treeTestCase(src);
    });

    test("set", () => {
      const src = `set { 1, 2 }`;
      treeTestCase(src);
    });

    test("map", () => {
      const src = `map { 1: 2, 3: 4 }`;
      treeTestCase(src);
    });

    test("field access", () => {
      const src = `x.y`;
      treeTestCase(src);
    });

    test("field access dynamic", () => {
      const src = `x[y]`;
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
  });
});
