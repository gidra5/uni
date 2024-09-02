import { describe, expect, it } from "vitest";
import { group, infix, name } from "../src/parser/ast";
import { matchString } from "../src/parser/string";

describe("parsing", () => {
  const stringTreeMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach(([testTree, ...result]) =>
      _it(`matches tree in example '${src}'`, () => expect(matchString(testTree, src)).toEqual(result))
    );
  const patternMatcherTestCase = (src, testTrees, _it: any = it) =>
    testTrees.forEach((testTree) =>
      _it(`matches tree in example '${src}'`, () => expect(matchString(testTree, src)[0]).toEqual(true))
    );

  patternMatcherTestCase("_", [{ name: "a" }, { name: "b" }, { name: "c", children: [{ name: "d" }] }]);

  patternMatcherTestCase("_+_", [
    infix(group("+"), name("d"), name("e")),
    infix(group("+"), infix(group("+"), name("d"), name("e")), infix(group("+"), name("d2"), name("e2"))),
  ]);

  patternMatcherTestCase("a+a", [
    infix(group("+"), name("b"), name("b")),
    infix(group("+"), infix(group("+"), name("d"), name("e")), infix(group("+"), name("d"), name("e"))),
  ]);

  patternMatcherTestCase("_ _ _", [
    infix(group("application"), infix(group("application"), name("a"), name("b")), name("b")),
    infix(
      group("application"),
      infix(group("application"), infix(group("application"), name("a"), name("b")), name("b")),
      name("b")
    ),
  ]);

  stringTreeMatcherTestCase("a", [
    [{ name: "a" }, true, Object.assign([], { a: { name: "a" } })],
    [{ name: "b" }, true, Object.assign([], { a: { name: "b" } })],
    [
      { name: "+", children: [{ name: "c" }, { name: "d" }] },
      true,
      Object.assign([], { a: { name: "+", children: [{ name: "c" }, { name: "d" }] } }),
    ],
  ]);

  stringTreeMatcherTestCase("_+a", [
    [infix(group("+"), name("d"), name("e")), true, Object.assign([name("d")], { a: name("e") })],
    [
      infix(group("+"), infix(group("+"), name("d"), name("e")), infix(group("+"), name("d2"), name("e2"))),
      true,
      Object.assign([infix(group("+"), name("d"), name("e"))], { a: infix(group("+"), name("d2"), name("e2")) }),
    ],
  ]);

  stringTreeMatcherTestCase("a+a", [
    [name("a"), false, []],
    [name("b"), false, []],
    [infix(group("+"), name("c"), name("c")), true, Object.assign([], { a: name("c") })],
    [infix(group("+"), name("c"), name("d")), false, Object.assign([], { a: name("c") })],
  ]);
});
