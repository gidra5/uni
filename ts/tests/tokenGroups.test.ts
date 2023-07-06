import { test } from "@fast-check/vitest";
import { assert, expect } from "vitest";
import { Token, TokenGroupDefinition } from "../src/parser/types";
import { parseTokensToGroup } from "../src/parser/tokenGroups";

test("should parse tokens to operator with correct structure", () => {
  const sourceTokens: Token[] = [
    { type: "whitespace", src: " " },
    { type: "identifier", src: "b" },
    { type: "newline", src: "\n" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    leadingTokens: [" "],
    separators: [{ tokens: ["\n"], repeats: [0, 1] }],
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

  const [index, operator, errors] = parseTokensToGroup(sourceTokens, 0, operatorDefinition, scope);

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
    leadingTokens: [" "],
    separators: [{ tokens: ["\n"], repeats: [0, 1] }],
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

  const [index, operator, errors] = parseTokensToGroup(sourceTokens, 0, operatorDefinition, scope);

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
    leadingTokens: ["if"],
    separators: [
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

  const [index, operator, errors] = parseTokensToGroup(sourceTokens, 0, operatorDefinition, scope);

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(9);
});

test("parses if with spaces", () => {
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
    leadingTokens: ["if"],
    separators: [
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

  const [index, operator, errors] = parseTokensToGroup(sourceTokens, 0, operatorDefinition, scope);

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(15);
});

test("parses infinite max repeating", () => {
  const sourceTokens: Token[] = [
    { type: "identifier", src: "," },
    { type: "identifier", src: "a" },
    { type: "identifier", src: "," },
    { type: "identifier", src: "a" },
    { type: "identifier", src: "," },
    { type: "identifier", src: "a" },
  ];

  const operatorDefinition: TokenGroupDefinition = {
    leadingTokens: [","],
    separators: [{ tokens: [","], repeats: [0, Infinity] }],
    precedence: [1, 2],
  };

  const scope = {};
  const expectedOperator = {
    token: { type: "identifier", src: "," },
    children: [
      {
        separatorIndex: 0,
        separatorToken: { type: "identifier", src: "," },
        children: [{ type: "identifier", src: "a" }],
      },
      {
        separatorIndex: 0,
        separatorToken: { type: "identifier", src: "," },
        children: [{ type: "identifier", src: "a" }],
      },
    ],
  };

  const [index, operator, errors] = parseTokensToGroup(sourceTokens, 0, operatorDefinition, scope);

  expect(operator).toEqual(expectedOperator);
  expect(errors).toEqual([]);
  expect(index).toBe(sourceTokens.length - 1);
});
