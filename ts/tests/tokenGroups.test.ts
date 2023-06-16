import { test } from "@fast-check/vitest";
import { expect } from "vitest";
import { Token, TokenGroupDefinition } from "../src/parser/types";
import { parseTokensToOperator } from "../src/parser/tokenGroups";

test("should parse tokens to operator with correct structure", () => {
  const sourceTokens: Token[] = [
    { type: "whitespace", src: " " },
    { type: "identifier", src: "b" },
    { type: "newline", src: "\n" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    separators: [
      { tokens: [" "], repeats: [1, 1] },
      { tokens: ["\n"], repeats: [0, 1] },
    ],
    precedence: [null, null],
  };

  const scope = {};
  const expectedOperator = {
    token: { type: "whitespace", src: " " },
    children: [
      {
        separatorIndex: 1,
        separatorToken: { type: "newline", src: "\n" },
        children: [{ type: "identifier", src: "b" }],
      },
    ],
  };

  const [index, operator, errors] = parseTokensToOperator(sourceTokens, 0, operatorDefinition, scope);
  console.dir({ operator, index, errors }, { depth: null });

  expect(index).toBe(3);
  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
});

test("should parse tokens to operator with correct structure", () => {
  const sourceTokens: Token[] = [
    { type: "whitespace", src: " " },
    { type: "identifier", src: "b" },
    { type: "whitespace", src: " " },
    { type: "identifier", src: "c" },
    { type: "newline", src: "\n" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    separators: [
      { tokens: [" "], repeats: [1, 1] },
      { tokens: ["\n"], repeats: [0, 1] },
    ],
    precedence: [null, null],
  };

  const scope = {};
  const expectedOperator = {
    token: { type: "whitespace", src: " " },
    children: [
      {
        separatorIndex: 1,
        separatorToken: { type: "newline", src: "\n" },
        children: [
          { type: "identifier", src: "b" },
          { type: "whitespace", src: " " },
          { type: "identifier", src: "c" },
        ],
      },
    ],
  };

  const [index, operator, errors] = parseTokensToOperator(sourceTokens, 0, operatorDefinition, scope);
  console.dir({ operator, index, errors }, { depth: null });

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(5);
});

test("parses if", () => {
  const sourceTokens: Token[] = [
    { type: "identifier", src: "if" },
    { type: "identifier", src: "not" },
    { type: "identifier", src: "x" },
    { type: "identifier", src: ">" },
    { type: "number", src: "4" },
    { type: "identifier", src: ":" },
    { type: "number", src: "4" },
    { type: "identifier", src: "!" },
    { type: "identifier", src: "else" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    separators: [
      { tokens: ["if"], repeats: [1, 1] },
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, 2],
  };

  const scope = {};
  const expectedOperator = {
    token: { type: "identifier", src: "if" },
    children: [
      {
        separatorIndex: 1,
        separatorToken: { type: "identifier", src: ":" },
        children: [
          { type: "identifier", src: "not" },
          { type: "identifier", src: "x" },
          { type: "identifier", src: ">" },
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
  };

  const [index, operator, errors] = parseTokensToOperator(sourceTokens, 0, operatorDefinition, scope);
  console.dir({ operator, expectedOperator, index, errors }, { depth: null });

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(9);
});

test("parses if 2", () => {
  const sourceTokens: Token[] = [
    { type: "identifier", src: "if" },
    { type: "whitespace", src: " " },
    { type: "identifier", src: "not" },
    { type: "whitespace", src: " " },
    { type: "identifier", src: "x" },
    { type: "whitespace", src: " " },
    { type: "identifier", src: ">" },
    { type: "whitespace", src: " " },
    { type: "number", src: "4" },
    { type: "identifier", src: ":" },
    { type: "whitespace", src: " " },
    { type: "number", src: "4" },
    { type: "identifier", src: "!" },
    { type: "whitespace", src: " " },
    { type: "identifier", src: "else" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    separators: [
      { tokens: ["if"], repeats: [1, 1] },
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, 2],
  };

  const scope = {};
  const expectedOperator = {
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
  };

  const [index, operator, errors] = parseTokensToOperator(sourceTokens, 0, operatorDefinition, scope);
  console.dir({ operator, expectedOperator, index, errors }, { depth: null });

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(15);
});
