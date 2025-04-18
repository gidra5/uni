import { beforeEach, expect, it } from "vitest";
import { FileMap } from "codespan-napi";
import { Injectable, register } from "../src/utils/injector";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { validate, validateTokenGroups } from "../src/analysis/validate";
import { Tree } from "../src/ast";

beforeEach(() => {
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
});

function clearIds(ast: Tree) {
  if (ast.children.length > 0) {
    ast.children.forEach(clearIds);
  }
  delete (ast as any).id;
  return ast;
}

const _testCase = (input: string) => {
  const tokens = parseTokenGroups(input);
  // console.dir(tokens, { depth: null });
  const [tokenErrors, validatedTokens] = validateTokenGroups(tokens);
  // console.dir(validatedTokens, { depth: null });
  const ast = parseScript(validatedTokens);
  // console.dir(ast, { depth: null });
  const [errors, validated] = validate(ast);
  // console.dir(validated, { depth: null });

  const fileMap = new FileMap();
  fileMap.addFile("<test>", input);
  const fileId = fileMap.getFileId("<test>");
  for (const error of tokenErrors) error.withFileId(fileId).print(fileMap);
  for (const error of errors) error.withFileId(fileId).print(fileMap);

  expect(tokenErrors.map((e) => e.toObject())).toMatchSnapshot("token errors");
  expect(errors.map((e) => e.toObject())).toMatchSnapshot("errors");
  expect(clearIds(validated)).toMatchSnapshot("ast");
};

it(`single closing parens`, () => _testCase(")"));
it(`single open parens`, () => _testCase("("));
it(`single open parens with number`, () => _testCase("(1"));
it(`single closing brace`, () => _testCase("}"));
it(`single open brace`, () => _testCase("{"));
it(`single closing bracket`, () => _testCase("]"));
it(`single open bracket`, () => _testCase("["));
it(`literal inside unclosed brace inside parens`, () => _testCase("({ 1 )"));
it(`unclosed indexing inside parens`, () => _testCase("(x[1 )"));
it(`literal inside unclosed parens inside braces`, () => _testCase("{ (1 }"));
it(`unclosed indexing inside braces`, () => _testCase("{ x[1 }"));
it(`unclosed parens inside indexing`, () => _testCase("x[(1]"));
it(`literal inside unclosed brace inside indexing`, () => _testCase("x[{ 1 ]"));
it.todo(`num literal application`, () => _testCase("1 2"));
it.todo(`string literal application`, () => _testCase('"1" 2'));
it.todo(`infix operation add no lhs`, () => _testCase("1 +"));
it.todo(`infix operation mult no lhs`, () => _testCase("1 *"));
it.todo(`infix operation mult no rhs`, () => _testCase("* 1"));
it.todo(`infix operation mult no rhs inside parens`, () => _testCase("1 * (* 2)"));
it.todo(`add mult no middle operand`, () => _testCase("1 + * 2"));
it.todo(`add add no middle operand`, () => _testCase("1 + + 2"));
it.todo(`infix operation add long parens no lhs`, () => _testCase("1 + (2 + 3) +"));
it.todo(`infix operation add no lhs`, () => _testCase("1 + 2 + "));
it.todo(`infix operation add unclosed parens`, () => _testCase("1 + (2 + 3"));
it.todo(`single closing parens`, () => _testCase("1 * (5/3) (*4"));
it.todo(`single closing parens`, () => _testCase("send((1+2), 3+,4)"));
it.todo(`single closing parens`, () => _testCase("!"));
it.todo(`single closing parens`, () => _testCase('"\\(")"'));
it.todo(`single closing parens`, () => _testCase("f + !"));
it.only(`single closing parens`, () => _testCase('"uwu\n 1'));
it.todo(`single closing parens`, () => _testCase("1 + (2 + 3))"));
it.todo(`single closing parens`, () => _testCase("1 + (2 + 3)) +"));
it.todo(`single closing parens`, () => _testCase("q + )/"));
it.todo(`single closing parens`, () => _testCase("q + )/"));
it.todo(`single closing parens`, () => _testCase(" - )/q + )/"));

// testCase(
//   `
//     quick_sort := xs -> {
//       if xs == ()
//         return ()

//       (pivot, ...rest) := xs
//       smaller := for x in rest: if x < pivot: x
//       bigger := for x in rest: if x >= pivot: x
//       return (...self smaller, pivot, ...self bigger)
//     }

//     quick_sort (5,3,4,2,1,2)
//   `,
//   [],
//   it.todo
// );
// testCase(
//   `
//     bubble_sort := fn mut list -> {
//       for i in range 0 list.length
//       for j in range 0 (list.length - i - 1)
//       if list[j] > list[j+1]
//         list[j], list[j+1] = list[j+1], list[j]
//       return list
//     }

//     bubble_sort (5,3,4,2,1,2)
//   `,
//   [],
//   it.todo
// );

// testCase(
//   '1 + (2 + 3))',
//   [
//     {
//       message: 'unbalanced parens',
//       cause: [],
//       pos: { start: 7, end: 8 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '1 + (2 + 3)) +',
//   [
//     {
//       message: 'unbalanced parens',
//       cause: [],
//       pos: { start: 7, end: 8 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 9, end: 9 },
//         },
//       ],
//       pos: { start: 8, end: 9 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   ' q + )/',
//   [
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 2, end: 3 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 4, end: 4 },
//         },
//       ],
//       pos: { start: 3, end: 4 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   ' - )/q + )/',
//   [
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 1, end: 2 },
//     },
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 5, end: 6 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 7, end: 7 },
//         },
//       ],
//       pos: { start: 6, end: 7 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   'send(-(2x+7)/A[j, i], 127.0.0.1)',
//   [
//     {
//       message: 'unexpected token inside fn args',
//       cause: [
//         {
//           message: 'unexpected token inside parens',
//           cause: [
//             {
//               message: 'unexpected token: "x"',
//               cause: [],
//               pos: { start: 5, end: 6 },
//             },
//           ],
//           pos: { start: 3, end: 9 },
//         },
//       ],
//       pos: { start: 2, end: 11 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 11, end: 12 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 15, end: 16 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 18, end: 19 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   'send(-(2x+7)/A[j, i], 127.0.0.1 ) + )/',
//   [
//     {
//       message: 'unexpected token inside fn args',
//       cause: [
//         {
//           message: 'unexpected token inside parens',
//           cause: [
//             {
//               message: 'unexpected token: "x"',
//               cause: [],
//               pos: { start: 5, end: 6 },
//             },
//           ],
//           pos: { start: 3, end: 9 },
//         },
//       ],
//       pos: { start: 2, end: 11 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 11, end: 12 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 15, end: 16 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 18, end: 19 },
//     },
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 22, end: 23 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 24, end: 24 },
//         },
//       ],
//       pos: { start: 23, end: 24 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '1 - 1)*1',
//   [
//     {
//       message: 'unexpected closing parenthesis after value',
//       cause: [],
//       pos: { start: 3, end: 4 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '1 - 1)*1+',
//   [
//     {
//       message: 'unexpected closing parenthesis after value',
//       cause: [],
//       pos: { start: 3, end: 4 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 7, end: 7 },
//         },
//       ],
//       pos: { start: 6, end: 7 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '(2x^2-5x+7)-(-i)+ (j++)/0 - )(*f)(2, 7-x, )/q + send(-(2x+7)/A[j, i], 127.0.0.1 ) + )/',
//   [
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: 'unexpected token: "x"',
//           cause: [],
//           pos: { start: 2, end: 3 },
//         },
//       ],
//       pos: { start: 0, end: 11 },
//     },
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: 'unexpected token: "++"',
//           cause: [],
//           pos: { start: 19, end: 20 },
//         },
//       ],
//       pos: { start: 17, end: 21 },
//     },
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 24, end: 25 },
//     },
//     {
//       message: 'missing operator',
//       cause: [],
//       pos: { start: 25, end: 25 },
//     },
//     {
//       message: "symbol can't be used in place of value",
//       cause: [],
//       pos: { start: 26, end: 27 },
//     },
//     {
//       message: 'missing operator',
//       cause: [],
//       pos: { start: 29, end: 29 },
//     },
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: 'unexpected token: ","',
//           cause: [],
//           pos: { start: 31, end: 32 },
//         },
//       ],
//       pos: { start: 29, end: 37 },
//     },
//     {
//       message: 'unexpected token inside fn args',
//       cause: [
//         {
//           message: 'unexpected token inside parens',
//           cause: [
//             {
//               message: 'unexpected token: "x"',
//               cause: [],
//               pos: { start: 45, end: 46 },
//             },
//           ],
//           pos: { start: 43, end: 49 },
//         },
//       ],
//       pos: { start: 42, end: 51 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 51, end: 52 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 55, end: 56 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 58, end: 59 },
//     },
//     {
//       message: 'unexpected closing parenthesis, expected value',
//       cause: [],
//       pos: { start: 62, end: 63 },
//     },
//     {
//       message: 'missing operand',
//       cause: [
//         {
//           message: 'end of tokens',
//           cause: [],
//           pos: { start: 64, end: 64 },
//         },
//       ],
//       pos: { start: 63, end: 64 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '(2^2-5x+7)-(-i)+ (j)/0 - 1)*(1*f)+(27-x, )/q + send(-(2+7)/A,[j, i, 127.0.1 ) + 1)/1',
//   [
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: 'unexpected token: "x"',
//           cause: [],
//           pos: { start: 6, end: 7 },
//         },
//       ],
//       pos: { start: 0, end: 10 },
//     },
//     {
//       message: 'unexpected closing parenthesis after value',
//       cause: [],
//       pos: { start: 23, end: 24 },
//     },
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: 'unexpected token: ","',
//           cause: [],
//           pos: { start: 35, end: 36 },
//         },
//       ],
//       pos: { start: 31, end: 37 },
//     },
//     {
//       message: 'unexpected token inside fn args',
//       cause: [
//         {
//           message: "symbol can't be used in place of value",
//           cause: [],
//           pos: { start: 51, end: 52 },
//         },
//       ],
//       pos: { start: 51, end: 51 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 51, end: 52 },
//     },
//     {
//       message: 'expected comma or closing parens',
//       cause: [],
//       pos: { start: 57, end: 58 },
//     },
//     {
//       message: 'unexpected closing parenthesis after value',
//       cause: [],
//       pos: { start: 61, end: 62 },
//     },
//   ],
//   it.todo
// );

// testCase(
//   '(,) + .. + a',
//   [
//     {
//       message: 'unexpected token inside parens',
//       cause: [
//         {
//           message: "symbol can't be used in place of value",
//           cause: [],
//           pos: { start: 1, end: 2 },
//         },
//         {
//           message: 'unexpected token: ","',
//           cause: [],
//           pos: { start: 1, end: 2 },
//         },
//       ],
//       pos: { start: 0, end: 3 },
//     },
//     {
//       message: "symbol can't be used in place of value",
//       cause: [],
//       pos: { start: 4, end: 5 },
//     },
//   ],
//   it.todo
// );
