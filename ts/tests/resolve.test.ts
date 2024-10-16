import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { pick } from "../../src/utils";
import { scopeDictionary } from "../../src/parser/constants";

const treeScopeTestCase = (src, expectedScope?, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = new Scope(scope);
  const [tree, errors] = parseExpr(context)(tokens).slice(1);
  const resolvedTree = resolve(tree as AbstractSyntaxTree);
  // console.dir(resolvedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedScope) expect(resolvedTree.data.scope).toEqual(expectedScope);
  expect(resolvedTree).toMatchSnapshot();
};

describe("expressions", () => {
  describe("function expressions", () => {
    test("function multiple params", () => {
      const src = `fn x, y -> x + y`;
      treeScopeTestCase(src);
    });

    test("function", () => {
      const src = `x -> x`;
      treeScopeTestCase(src);
    });

    test("function with placeholder arg", () => {
      const src = `_ -> #0`;
      treeScopeTestCase(src, null, pick(scopeDictionary, ["->", "#"]));
    });

    test("function with shadowed name access", () => {
      const src = `fn a -> fn a -> #a`;
      treeScopeTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });

    test("function with deep shadowed name access", () => {
      const src = `fn a -> fn a -> fn a -> ##a`;
      treeScopeTestCase(src, null, pick(scopeDictionary, ["fn", "#"]));
    });
  });

  describe("pattern matching", () => {
    test("in function parameters", () => {
      const src = `(x, y) -> x + y`;
      treeScopeTestCase(src);
    });

    test("pattern union", () => {
      const src = `match a {
        (record { x, y } or record { y, z }) -> y
      }`;
      treeScopeTestCase(src);
    });

    test("pattern intersection", () => {
      const src = `match a {
        (record { x, y } and record { z }) -> x + y + z
      }`;
      treeScopeTestCase(src);
    });

    test("arrow function pattern union", () => {
      const src = `(record { x, y } or record { y, z }) -> x + y + z`;
      treeScopeTestCase(src);
    });

    test("with 'is' operator", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with placeholder", () => {
      const src = `x is (_, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with variable value", () => {
      const src = `x is (^a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with rest value", () => {
      const src = `x is (a, ...b) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with rest value first", () => {
      const src = `x is (...b, a) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with default value", () => {
      const src = `x is ((b = 4), a) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with rename", () => {
      const src = `x is record { b @ a } and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("with name for match", () => {
      const src = `x is ((a, b) @ c) and a == b + 1`;
      treeScopeTestCase(src);
    });

    test("binding visible in scope where it is true", () => {
      const src = `x is (a, b) and a == b + 1`;
      treeScopeTestCase(src);
    });
  });

  describe("structured programming", () => {
    test("if-then", () => {
      const src = `if true: 123`;
      treeScopeTestCase(src);
    });

    test("if-then-else", () => {
      const src = `if true: 123 else 456`;
      treeScopeTestCase(src);
    });

    test("for loop", () => {
      const src = `for x in [1, 2, 3]: x`;
      treeScopeTestCase(src);
    });

    test("while loop", () => {
      const src = `while true: 123`;
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