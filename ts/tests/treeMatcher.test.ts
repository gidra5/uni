import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { patternMatcher, stringTreeMatcher } from "../src/optimizer.js";

describe("parsing", () => {
  const stringTreeMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach(([testTree, ...result]) =>
      _it(`matches tree in example '${src}'`, () =>
        expect(stringTreeMatcher(src, testTree)).toEqual(result)
      )
    );
  const patternMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach((testTree) =>
      _it(`matches tree in example '${src}'`, () =>
        expect(patternMatcher(src, testTree)).toEqual(true)
      )
    );

  patternMatcherTestCase("_", [
    { name: "a" },
    { name: "b" },
    { name: "c", children: [{ name: "d" }] },
  ]);

  patternMatcherTestCase("_+_", [
    { name: "+", children: [{ name: "d" }, { name: "e" }] },
    {
      name: "+",
      children: [
        { name: "+", children: [{ name: "d" }, { name: "e" }] },
        { name: "+", children: [{ name: "d2" }, { name: "e3" }] },
      ],
    },
  ]);

  patternMatcherTestCase("a+a", [
    { name: "+", children: [{ name: "b" }, { name: "b" }] },
    {
      name: "+",
      children: [
        { name: "+", children: [{ name: "d" }, { name: "e" }] },
        { name: "+", children: [{ name: "d" }, { name: "e" }] },
      ],
    },
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
    [
      { name: "+", children: [{ name: "c" }, { name: "c" }] },
      true,
      { a: { name: "c" } },
    ],
    [
      { name: "+", children: [{ name: "c" }, { name: "d" }] },
      false,
      { a: { name: "c" } },
    ],
  ]);
});
