import { parseToken, parseTokens, type Token } from "../src/parser/tokens.js";
import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";

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

  describe("algebraic types", () => {
    test("record", () => {
      const src = `(a: number; b: string)`;
      treeTestCase(src);
    });

    test("map", () => {
      const src = `([number]: string)`;
      treeTestCase(src);
    });

    test("map with key dependency", () => {
      const src = `([x: number]: (x, string))`;
      treeTestCase(src);
    });

    test("tuple", () => {
      const src = `number, string`;
      treeTestCase(src);
    });

    test("type key access", () => {
      const src = `type[number]`;
      treeTestCase(src);
    });

    test("type key access static", () => {
      const src = `type.key`;
      treeTestCase(src);
    });

    test("discriminated union from record type", () => {
      const src = `enum (a: number; b: string)`;
      treeTestCase(src);
    });

    test("discriminated by order union from tuple", () => {
      const src = `enum (number, string)`;
      treeTestCase(src);
    });
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

  test("typeof", () => {
    const src = `typeof x`;
    treeTestCase(src);
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
    const src = `my_type <= number`;
    treeTestCase(src);
  });
});
