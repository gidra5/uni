import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { matchString } from "../src/parser/utils";
import { group, infix, name } from "../src/parser/ast";

describe("parsing", () => {
  const stringTreeMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach(([testTree, ...result]) =>
      _it(`matches tree in example '${src}'`, () =>
        expect(matchString(testTree, src)).toEqual(result)
      )
    );
  const patternMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach((testTree) =>
      _it(`matches tree in example '${src}'`, () =>
        expect(matchString(testTree, src)[0]).toEqual(true)
      )
    );

  patternMatcherTestCase("_", [
    { name: "a" },
    { name: "b" },
    { name: "c", children: [{ name: "d" }] },
  ]);

  patternMatcherTestCase("_+_", [
    infix(group("+"), name("d"), name("e")),
    infix(
      group("+"),
      infix(group("+"), name("d"), name("e")),
      infix(group("+"), name("d2"), name("e2"))
    ),
  ]);

  patternMatcherTestCase("a+a", [
    infix(group("+"), name("b"), name("b")),
    infix(
      group("+"),
      infix(group("+"), name("d"), name("e")),
      infix(group("+"), name("d"), name("e"))
    ),
  ]);

  stringTreeMatcherTestCase("a", [
    [{ name: "a" }, true, { a: { name: "a" } }],
    [{ name: "b" }, true, { a: { name: "b" } }],
    [
      { name: "+", children: [{ name: "c" }, { name: "d" }] },
      true,
      { a: { name: "+", children: [{ name: "c" }, { name: "d" }] } },
    ],
  ]);

  stringTreeMatcherTestCase("a+a", [
    [{ name: "a" }, false, {}],
    [{ name: "b" }, false, {}],
    [infix(group("+"), name("c"), name("c")), true, { a: name("c") }],
    [infix(group("+"), name("c"), name("d")), false, { a: name("c") }],
  ]);
});
