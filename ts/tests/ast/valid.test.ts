import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { Iterator } from "iterator-js";
import { parseString } from "../../src/parser";
import { group, infix, name, number, prefix } from "../../src/parser/ast";
import { matchSeparators } from "../../src/parser/utils";

const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseString(src);
    expect(errors).toEqual(expectedErrors);
  });

const treeTestCase = (src, expectedTree, scope = {}, _it: any = it) =>
  _it(`produces correct tree in example '${src}'`, () => {
    const [tree, errors] = parseString(src, scope);
    console.dir(tree, { depth: null });
    expect(errors).toEqual([]);
    expect(tree).toEqual(expectedTree);
  });

describe("comments", () => {
  test.todo("comment", () => {
    const src = `// comment\n123`;
  });

  test.todo("comment block", () => {
    const src = `/* comment block */123`;
  });
});

describe("values", () => {
  test.todo("number", () => {
    const src = `123`;
  });

  test.todo("string", () => {
    const src = `"string"`;
  });
});

describe("expressions", () => {
  describe("fixity expressions", () => {
    test.todo("name", () => {
      const src = `name`;
    });

    test.todo("operator", () => {
      const src = `+`;
    });

    test.todo("group", () => {
      const src = `(1 + 2)`;
    });

    test.todo("prefix", () => {
      const src = `+123`;
    });

    test.todo("postfix", () => {
      const src = `123!`;
    });

    test.todo("infix", () => {
      const src = `123+456`;
    });

    test.todo("mixfix", () => {
      const src = `123 ? 456 : 789`;
    });
  });

  describe("arithmetics", () => {
    test.todo("add", () => {
      const src = `123 + 456`;
    });

    test.todo("subtract", () => {
      const src = `123 - 456`;
    });

    test.todo("multiply", () => {
      const src = `123 * 456`;
    });

    test.todo("divide", () => {
      const src = `123 / 456`;
    });

    test.todo("modulo", () => {
      const src = `123 % 456`;
    });

    test.todo("power", () => {
      const src = `123 ^ 456`;
    });

    test.todo("negate", () => {
      const src = `-123`;
    });

    test.todo("decrement", () => {
      const src = `--123`;
    });

    test.todo("increment", () => {
      const src = `++123`;
    });

    test.todo("postfix decrement", () => {
      const src = `123--`;
    });

    test.todo("postfix increment", () => {
      const src = `123++`;
    });

    treeTestCase(
      "1 + 2^3 * 4",
      infix(
        group("+"),
        number(1),
        infix(group("*"), infix(group("^"), number(2), number(3)), number(4))
      ),
      {},
      it.only
    );

    treeTestCase("--i", prefix(group("prefixDecrement"), name("i")));

    treeTestCase("-(a+b)", []);

    treeTestCase(
      "(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1",
      []
    );
  });

  describe("boolean expressions", () => {
    test.todo("in", () => {
      const src = `123 in 456`;
    });

    test.todo("is", () => {
      const src = `123 is 456`;
    });

    test.todo("and", () => {
      const src = `123 and 456`;
    });

    test.todo("or", () => {
      const src = `123 or 456`;
    });

    test.todo("not", () => {
      const src = `not 123`;
    });

    test.todo("equal", () => {
      const src = `123 == 456`;
    });

    test.todo("not equal", () => {
      const src = `123 != 456`;
    });

    describe("comparators", () => {
      const comparators = [
        ["<", "<="],
        [">", ">="],
      ];

      for (const op of Iterator.iter(comparators).flat()) {
        test.todo(`comparator ${op}`, () => {
          const src = `123 ${op} 456`;
        });
      }

      for (const [op1, op2] of Iterator.iter(comparators).flatMap((pair) =>
        Iterator.iter(pair).power(2)
      )) {
        test.todo(`range ${op1} ${op2}`, () => {
          const src = `123 ${op1} x ${op2} 456`;
        });
      }
    });
  });

  describe("function expressions", () => {
    test.todo("function", () => {
      const src = `x -> x`;
    });

    test.todo("function call", () => {
      const src = `f x`;
    });

    test.todo("function call multiple args", () => {
      const src = `f x y`;
    });

    treeTestCase(
      "send((1+2), 3)",
      prefix(
        group("send"),
        group(
          "parens",
          infix(
            group(","),
            group("parens", infix(group("+"), number(1), number(2))),
            number(3)
          )
        )
      ),
      {
        send: {
          separators: matchSeparators(["send"]),
          precedence: [null, Infinity],
        },
      }
    );

    treeTestCase(
      "send(2, 3)",
      infix(
        group("application"),
        name("send"),
        group("parens", infix(group(","), number(2), number(3)))
      )
    );

    treeTestCase(
      "(send)(2, 3)",
      infix(
        group("application"),
        group("parens", name("send")),
        group("parens", infix(group(","), number(2), number(3)))
      )
    );

    treeTestCase(
      "(send 1)(2, 3)",
      infix(
        group("application"),
        group("parens", infix(group("application"), name("send"), number(1))),
        group("parens", infix(group(","), number(2), number(3)))
      )
    );

    treeTestCase(
      "send 1 (2, 3)",
      infix(
        group("application"),
        infix(group("application"), name("send"), number(1)),
        group("parens", infix(group(","), number(2), number(3)))
      )
    );
  });

  describe("pattern matching", () => {
    test.todo("match", () => {
      const src = `match x { 1 => 2; 3 => 4 }`;
    });

    test.todo("in parameters", () => {
      const src = `(x, y) -> x + y`;
    });

    test.todo("with is operator", () => {
      const src = `x is (a, b)`;
    });

    test.todo("with placeholder", () => {
      const src = `x is (_, b)`;
    });
  });

  describe("structured programming", () => {
    test.todo("if-then", () => {
      const src = `if true: 123`;
    });

    test.todo("if-then-else", () => {
      const src = `if true: 123 else 456`;
    });
    test.todo("block", () => {
      const src = `{ 123 }`;
    });

    test.todo("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
    });

    test.todo("while loop", () => {
      const src = `while true: 123`;
    });

    test.todo("while loop break", () => {
      const src = `while true: break 1`;
    });

    test.todo("while loop continue", () => {
      const src = `while true: continue`;
    });

    test.todo("block break", () => {
      const src = `{ break 1 }`;
    });

    test.todo("labeled expression", () => {
      const src = `label: 123`;
    });

    test.todo("expression-label", () => {
      const src = `[123]: 456`;
    });

    test.todo("return", () => {
      const src = `() => { return 123 }`;
    });

    test.todo("block variable declaration", () => {
      const src = `{ x := 123 }`;
    });

    test.todo("block variable declaration with type", () => {
      const src = `{ x: number := 123 }`;
    });

    test.todo("block variable assignment", () => {
      const src = `{ x = 123 }`;
    });

    test.todo("block pattern matching", () => {
      const src = `{ x, y = 123, 456 }`;
    });
  });

  describe("data structures", () => {
    test.todo("tuple", () => {
      const src = `1, 2`;
    });

    test.todo("list", () => {
      const src = `[1, 2]`;
    });

    test.todo("record", () => {
      const src = `record { a: 1, b: 2 }`;
    });

    test.todo("set", () => {
      const src = `set { 1, 2 }`;
    });

    test.todo("map", () => {
      const src = `map { 1: 2, 3: 4 }`;
    });
  });
});

describe("programs", () => {
  describe("script", () => {
    test.todo("variable", () => {
      const src = `x := 123`;
    });
    test.todo("import", () => {
      const src = `x := 123;  import "a" as b`;
    });
    test.todo("import with", () => {
      const src = `x := 123;  import "a" as b with x `;
    });
    test.todo("export", () => {
      const src = `x := 123; export x`;
    });
    test.todo("export as", () => {
      const src = `x := 123; export x as y`;
    });
  });

  describe("module", () => {
    test.todo("import/use", () => {
      const src = `use "a" as b`;
    });
    test.todo("import/use with", () => {
      const src = `use "a" as b with c`;
    });
    test.todo("import/use with external", () => {
      const src = `use "a" as b with external c`;
    });
    test.todo("external", () => {
      const src = `external y`;
    });
    test.todo("private declare", () => {
      const src = `z := y+1`;
    });
    test.todo("public declare", () => {
      const src = `export x := z+123`;
    });
    test.todo("export main", () => {
      const src = `export (args) -> {}`;
    });
  });
});