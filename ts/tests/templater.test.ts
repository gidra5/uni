import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { group, infix, name } from "../src/parser/ast";
import { matchString, templateString } from "../src/parser/string";
import { omit } from "../src/utils";

describe("parsing", () => {
  const stringTreeMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach(([values, result]) =>
      _it(`matches tree in example '${src}'`, () =>
        expect(omit(templateString(src, values), ["data"])).toEqual(omit(result, ["data"]))
      )
    );

  stringTreeMatcherTestCase("_", [
    [[{ name: "a" }], { name: "a" }],
    [[{ name: "b" }], { name: "b" }],
    [[{ name: "c", children: [{ name: "d" }] }], { name: "c", children: [{ name: "d" }] }],
  ]);

  stringTreeMatcherTestCase("_+_", [
    [[name("d"), name("e")], infix(group("+"), name("d"), name("e"))],
    [
      [infix(group("+"), name("d"), name("e")), infix(group("+"), name("d2"), name("e2"))],
      infix(group("+"), infix(group("+"), name("d"), name("e")), infix(group("+"), name("d2"), name("e2"))),
    ],
  ]);

  stringTreeMatcherTestCase("a", [
    [Object.assign([], { a: { name: "a" } }), { name: "a" }],
    [Object.assign([], { a: { name: "b" } }), { name: "b" }],
    [
      Object.assign([], { a: { name: "+", children: [{ name: "c" }, { name: "d" }] } }),
      { name: "+", children: [{ name: "c" }, { name: "d" }] },
    ],
  ]);

  stringTreeMatcherTestCase("_+a", [
    [Object.assign([name("d")], { a: name("e") }), infix(group("+"), name("d"), name("e"))],
    [
      Object.assign([infix(group("+"), name("d"), name("e"))], { a: infix(group("+"), name("d2"), name("e2")) }),
      infix(group("+"), infix(group("+"), name("d"), name("e")), infix(group("+"), name("d2"), name("e2"))),
    ],
  ]);

  stringTreeMatcherTestCase("a+a", [
    [Object.assign([], { a: name("a") }), infix(group("+"), name("a"), name("a"))],
    [Object.assign([], { a: name("b") }), infix(group("+"), name("b"), name("b"))],
  ]);
});
