import { describe, expect } from "vitest";
import { Scope, SeparatorChildren, SyntaxTree, parseOperatorsToAST, parseStringToAST } from "../src/parser/new";
import { it } from "@fast-check/vitest";

describe("parseOperatorsToAST", () => {
  it("should parse a simple expression", () => {
    const scope: Scope = {
      "+": {
        separators: [{ tokens: ["+"], repeats: [1, 1] }],
        precedence: [1, 2],
      },
      "*": {
        separators: [{ tokens: ["*"], repeats: [1, 1] }],
        precedence: [3, 4],
      },
    };

    const src: SeparatorChildren = [
      { type: "number", src: "2" },
      { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
      { type: "number", src: "3" },
    ];

    const expected: SyntaxTree = {
      item: { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
      lhs: { item: { type: "number", src: "2" } },
      rhs: { item: { type: "number", src: "3" } },
    };

    const result = parseOperatorsToAST(src, 0, 0, scope);

    expect(result).toEqual([3, expected, []]);
  });

  it("should parse an expression with multiple operators", () => {
    const scope: Scope = {
      "+": {
        separators: [{ tokens: ["+"], repeats: [1, 1] }],
        precedence: [1, 2],
      },
      "*": {
        separators: [{ tokens: ["*"], repeats: [1, 1] }],
        precedence: [3, 4],
      },
    };

    const src: SeparatorChildren = [
      { type: "number", src: "2" },
      { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
      { type: "number", src: "3" },
      { type: "operator", id: "*", token: { type: "identifier", src: "*" }, children: [] },
      { type: "number", src: "4" },
    ];

    const expected: SyntaxTree = {
      item: { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
      lhs: { item: { type: "number", src: "2" } },
      rhs: {
        item: { type: "operator", id: "*", token: { type: "identifier", src: "*" }, children: [] },
        lhs: { item: { type: "number", src: "3" } },
        rhs: { item: { type: "number", src: "4" } },
      },
    };

    const result = parseOperatorsToAST(src, 0, 0, scope);

    expect(result).toEqual([5, expected, []]);
  });

  it("should handle errors when encountering invalid operator placement", () => {
    const scope: Scope = {
      "+": {
        separators: [{ tokens: ["+"], repeats: [1, 1] }],
        precedence: [1, 2],
      },
      "*": {
        separators: [{ tokens: ["*"], repeats: [1, 1] }],
        precedence: [3, 4],
      },
    };

    const src: SeparatorChildren = [
      { type: "operator", id: "*", token: { type: "identifier", src: "*" }, children: [] },
      { type: "number", src: "2" },
      { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
      { type: "number", src: "3" },
    ];

    const expected: SyntaxTree = { item: { type: "whitespace", src: "" } };

    const errors = [{ message: "infix operator without left operand" }];

    const result = parseOperatorsToAST(src, 0, 0, scope);

    expect(result).toEqual([0, expected, errors]);
  });

  it("should parse a string with complex expressions one level deep", () => {
    const scope: Scope = {
      "+": {
        separators: [{ tokens: ["+"], repeats: [1, 1] }],
        precedence: [1, 2],
      },
      if: {
        separators: [
          { tokens: ["if"], repeats: [1, 1] },
          { tokens: [":"], repeats: [1, 1] },
          { tokens: ["else"], repeats: [0, 1] },
        ],
        precedence: [null, 2],
      },
    };
    const src = "2 + if not x > 4: 4! else 5";
    const expected: SyntaxTree[] = [
      {
        item: { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
        lhs: { item: { type: "number", src: "2" } },
        rhs: {
          item: {
            type: "operator",
            id: "if",
            token: { type: "identifier", src: "if" },
            children: [
              {
                separatorIndex: 1,
                separatorToken: { type: "identifier", src: ":" },
                children: [
                  { type: "identifier", src: "not" },
                  { type: "whitespace", src: " " },
                  { type: "identifier", src: "x" },
                  { type: "whitespace", src: " " },
                  { type: "identifier", src: ">" },
                  { type: "whitespace", src: " " },
                  { type: "number", src: "4" },
                ],
              },
              {
                separatorIndex: 2,
                separatorToken: { type: "identifier", src: "else" },
                children: [
                  { type: "number", src: "4" },
                  { type: "identifier", src: "!" },
                ],
              },
            ],
          },
          rhs: { item: { type: "number", src: "5" } },
        },
      },
    ];

    const result = parseStringToAST(src, 0, scope);

    expect(result).toEqual([27, expected, []]);
  });
});

describe("parseStringToAST", () => {
  const scope: Scope = {
    "+": {
      separators: [{ tokens: ["+"], repeats: [1, 1] }],
      precedence: [1, 2],
    },
    "*": {
      separators: [{ tokens: ["*"], repeats: [1, 1] }],
      precedence: [3, 4],
    },
  };

  it("should parse a string with a single expression", () => {
    const src = "2 + 3";
    const expected: SyntaxTree[] = [
      {
        item: {
          token: { type: "identifier", src: "+" },
          children: [],
          id: "+",
          type: "operator",
        },
        lhs: { item: { type: "number", src: "2" } },
        rhs: { item: { type: "number", src: "3" } },
      },
    ];

    const result = parseStringToAST(src, 0, scope);

    expect(result).toEqual([5, expected, []]);
  });

  it("should parse a string with multiple expressions", () => {
    const src = "2 + 3 3 * 4";
    const expected: SyntaxTree[] = [
      {
        item: { type: "operator", id: "+", token: { type: "identifier", src: "+" }, children: [] },
        lhs: { item: { type: "number", src: "2" } },
        rhs: { item: { type: "number", src: "3" } },
      },
      {
        item: { type: "operator", id: "*", token: { type: "identifier", src: "*" }, children: [] },
        lhs: { item: { type: "number", src: "3" } },
        rhs: { item: { type: "number", src: "4" } },
      },
    ];

    const result = parseStringToAST(src, 0, scope);

    expect(result).toEqual([11, expected, []]);
  });
});
