import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import { position } from "../../src/position.js";
import { TokenPos } from "../../src/parser/types.js";

// comments
test.todo("comment", () => {
  const src = `// comment\n123`;
});

test.todo("comment block", () => {
  const src = `/* comment block */123`;
});

// values
test.todo("number", () => {
  const src = `123`;
});

test.todo("string", () => {
  const src = `"string"`;
});

// names and expressions
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

// functional programming constructs
test.todo("function", () => {
  const src = `x -> x`;
});

test.todo("function call", () => {
  const src = `f x`;
});

test.todo("match", () => {
  const src = `match x { 1 => 2; 3 => 4 }`;
});

test.todo("patterns in parameters", () => {
  const src = `(x, y) -> x + y`;
});

// structured programming constructs
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

// constructors

test.todo("tuple", () => {
  const src = `x := 1, 2`;
});

test.todo("list", () => {
  const src = `x := [1, 2]`;
});

test.todo("record", () => {
  const src = `x := { a: 1, b: 2 }`;
});

test.todo("set", () => {
  const src = `x := { 1, 2 }`;
});

test.todo("map", () => {
  const src = `x := { 1: 2, 3: 4 }`;
});

// programs

test.todo("script", () => {
  const src = `x := 123; b := import "a" with x; x=x+1; x`;
});

test.todo("module", () => {
  const src = `use "a" as b with external params; external y; z := y+1; export x := z+123`;
});
