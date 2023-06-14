import {
  parseTokensToOperator,
  OperatorDefinition,
  ScopeGenerator,
  Scope,
  OperatorInstance,
  parseStringToOperators,
  parseToken,
  parseTokens,
  Token,
} from "../src/parser/new.js";
import { assert, beforeEach, describe, expect, vi } from "vitest";
import { it, fc, test } from "@fast-check/vitest";

// fc.configureGlobal({
//   numRuns: 1,
//   timeout: 10 * 1000,
//   interruptAfterTimeLimit: 60 * 1000,
//   skipAllAfterTimeLimit: 20 * 1000,
// });

// // Properties
// describe("parse operator", () => {
//   const operatorDefArb = fc.letrec<{
//     def: OperatorDefinition;
//     scope: ScopeGenerator;
//   }>((tie) => ({
//     def: fc.record({
//       separators: fc
//         .array(
//           fc.record({
//             tokens: fc.array(fc.string({ minLength: 1, size: "xsmall" }), {
//               minLength: 1,
//               size: "xsmall",
//             }),
//             repeats: fc
//               .tuple(fc.nat(), fc.nat())
//               .filter(([min, max]) => 0 < min && min <= max),
//             scope: tie("scope"),
//           }),
//           { minLength: 1, size: "xsmall" }
//         )
//         .filter((separators) => separators[0].repeats[0] > 0),
//       precedence: fc.tuple(
//         fc.oneof(fc.nat(), fc.constant(null)),
//         fc.oneof(fc.nat(), fc.constant(null))
//       ),
//     }),
//     scope: fc.option(
//       fc.func(
//         fc.oneof(
//           { maxDepth: 1, withCrossShrink: true },
//           fc.constant({}),
//           fc.dictionary(fc.uuid(), tie("def"), { size: "xsmall" })
//         )
//       ),
//       { maxDepth: 1 }
//     ),
//   })).def;

//   const inputArb = fc
//     .tuple(fc.string({ minLength: 1 }), fc.nat())
//     .filter(([s, i]) => i >= 0 && i <= s.length);

//   it("should always end within source bounds", () =>
//     fc.assert(
//       fc.property(
//         inputArb,
//         operatorDefArb,
//         fc.dictionary(fc.uuid(), operatorDefArb),
//         ([src, index], op, scope) => {
//           const [_index] = parseStringToOperators(src, index, op, scope);
//           assert(_index >= index);
//           assert(_index <= src.length);
//         }
//       )
//     ));

//   describe("when no errors", () => {
//     const argsArbNoError = fc
//       .tuple(inputArb, operatorDefArb, fc.dictionary(fc.uuid(), operatorDefArb))
//       .map(
//         ([[src, index], op, scope]) =>
//           [
//             parseTokensToOperator(src, index, op, scope),
//             [src, index, op, scope] as const,
//           ] as const
//       )
//       .filter(([[, , errors]]) => errors.length === 0);
//     it("should always have children within bounds of separators repetition sum", () => {
//       fc.assert(
//         fc.property(argsArbNoError, ([[, result], [, , op]]) => {
//           const min = op.separators.reduce(
//             (acc, { repeats: [min] }) => acc + min,
//             0
//           );
//           const max = op.separators.reduce(
//             (acc, { repeats: [, max] }) => acc + max,
//             0
//           );
//           const count = result.children.length;

//           assert(count >= min);
//           assert(count <= max);
//         })
//       );
//     });

//     it("should always have children ordered in ascending order of separator index", () => {
//       fc.assert(
//         fc.property(argsArbNoError, ([[, result]]) => {
//           const { children } = result;

//           assert(
//             children.every(({ separatorIndex: index1 }, i, array) => {
//               const rest = array.slice(i + 1);
//               return rest.every(
//                 ({ separatorIndex: index2 }) => index1 <= index2
//               );
//             })
//           );
//         })
//       );
//     });

//     it("sep-index and sep-token should match with sep-definition", () => {
//       fc.assert(
//         fc.property(argsArbNoError, ([[, result], [, , op]]) => {
//           const { children } = result;

//           assert(
//             children.every(
//               ({ separatorIndex: index, separatorToken: token }) => {
//                 const sepDef = op.separators[index];
//                 return sepDef.tokens.includes(token);
//               }
//             )
//           );
//         })
//       );
//     });
//   });
// });

// test("test cases", () => {
//   const input = "(a, b, c, 123; (d,e, f   ,g)) ? a : (b)";
//   const expect: OperatorInstance = {
//     token: { type: "identifier", src: "(" },
//     children: [
//       {
//         children: [{ type: "identifier", src: "a" }],
//         separatorIndex: 1,
//         separatorToken: { type: "identifier", src: "," },
//       },
//       {
//         children: [{ type: "identifier", src: "b" }],
//         separatorIndex: 1,
//         separatorToken: { type: "identifier", src: "," },
//       },
//       {
//         children: [{ type: "identifier", src: "c" }],
//         separatorIndex: 1,
//         separatorToken: { type: "identifier", src: "," },
//       },
//       {
//         children: [{ type: "number", src: "123" }],
//         separatorIndex: 1,
//         separatorToken: { type: "identifier", src: ";" },
//       },
//       {
//         children: [
//           {
//             token: { type: "identifier", src: "(" },
//             id: "id1",
//             type: "operator",
//             children: [
//               {
//                 children: [{ type: "identifier", src: "d" }],
//                 separatorIndex: 1,
//                 separatorToken: { type: "identifier", src: "," },
//               },
//               {
//                 children: [{ type: "identifier", src: "e" }],
//                 separatorIndex: 1,
//                 separatorToken: { type: "identifier", src: "," },
//               },
//               {
//                 children: [{ type: "identifier", src: "f" }],
//                 separatorIndex: 1,
//                 separatorToken: { type: "identifier", src: "," },
//               },
//               {
//                 children: [{ type: "identifier", src: "g" }],
//                 separatorIndex: 2,
//                 separatorToken: { type: "identifier", src: ")" },
//               },
//             ],
//           },
//         ],
//         separatorIndex: 2,
//         separatorToken: { type: "identifier", src: ")" },
//       },
//     ],
//   };
//   const scope: Scope = {
//     id1: {
//       separators: [
//         { tokens: ["("], repeats: [1, 1] },
//         { tokens: [",", ";"], repeats: [0, Infinity] },
//         { tokens: [")"], repeats: [1, 1] },
//       ],
//     },
//     id2: {
//       separators: [
//         { tokens: ["?"], repeats: [1, 1] },
//         { tokens: [":"], repeats: [1, 1] },
//       ],
//     },
//   };
//   const [index, instance, errors] = parseTokensToOperator(
//     input,
//     0,
//     scope["id1"],
//     scope
//   );

//   assert(index === 29);
//   assert(errors.length === 0);
//   deepStrictEqual(instance, expect);
//   const expect2: OperatorInstance = {
//     token: "?",
//     children: [{ children: [" a "], separatorIndex: 1, separatorToken: ":" }],
//   };
//   const [index2, instance2, errors2] = parseTokensToOperator(
//     input,
//     index + 1,
//     scope["id2"],
//     scope
//   );

//   assert(errors2.length === 0);
//   deepStrictEqual(instance2, expect2);
//   assert(index2 === index + 6);
//   const expect3: OperatorInstance = {
//     token: "(",
//     children: [{ children: ["b"], separatorIndex: 2, separatorToken: ")" }],
//   };
//   const [index3, instance3, errors3] = parseTokensToOperator(
//     input,
//     index2 + 1,
//     scope["id1"],
//     scope
//   );

//   assert(errors3.length === 0);
//   deepStrictEqual(instance3, expect3);
//   assert(index3 === index2 + 4);
// });

// pass fixed seed, so that it are deterministic
// describe("generic query storage", function () {
// const { GenericQueryStorage } = cachejs;
// it.concurrent.prop([fc.string(), fc.anything(), fc.anything()])(
//   "should store and retrieve values correctly",
//   (key, params, value) => {
//     const queryStorage = new GenericQueryStorage();
//     queryStorage.set(key, params, value);
//     const retrievedValue = queryStorage.get(key, params);
//     expect(retrievedValue).to.equal(value);
//   }
// );
// it.concurrent.prop([fc.string(), fc.clone(fc.anything(), 2)])(
//   "should compare params structurally",
//   (key, [params, paramsClone]) => {
//     const queryStorage = new GenericQueryStorage();
//     queryStorage.set(key, params, {});
//     const retrievedValue = queryStorage.get(key, params);
//     const retrievedValue2 = queryStorage.get(key, paramsClone);
//     expect(retrievedValue).to.equal(retrievedValue2);
//   }
// );
// it.concurrent.prop([fc.string(), fc.anything(), fc.anything()], {
//   examples: [
//     ["", [], ""],
//     ["", {}, false],
//     ["", [], {}],
//   ],
// })("should correctly check if a key exists", (key, params, value) => {
//   const queryStorage = new GenericQueryStorage();
//   expect(queryStorage.has(key, params)).to.be.false;
//   queryStorage.set(key, params, value);
//   expect(queryStorage.has(key, params)).to.be.true;
// });
// it.concurrent.prop([fc.string(), fc.anything(), fc.anything()], {
//   examples: [["toString", {}, ""]],
// })("should clear values correctly", (key, params, value) => {
//   const queryStorage = new GenericQueryStorage();
//   queryStorage.set(key, params, value);
//   expect(queryStorage.has(key, params)).to.be.true;
//   queryStorage.clear(key, params);
//   expect(queryStorage.has(key, params)).to.be.false;
// });
// it.concurrent.prop([fc.string(), fc.anything(), fc.anything(), fc.anything()], {
//   examples: [["toString", false, [], []]],
// })("should always return the last set value for a key", (key, params, value1, value2) => {
//   const queryStorage = new GenericQueryStorage();
//   queryStorage.set(key, params, value1);
//   queryStorage.set(key, params, value2);
//   const retrievedValue = queryStorage.get(key, params);
//   expect(retrievedValue).to.equal(value2);
// });
// });
// Import the functions to be tested

// Test parseToken function

// Test case: Parsing a string token
test.concurrent.prop([fc.string().filter((s) => !s.includes("\\") && !s.includes('"'))])(
  "parseToken - string token",
  (value) => {
    const src = `"${value}"`;
    const startIndex = 0;
    const expectedToken = { type: "string", src, value };
    const expectedIndex = value.length + 2;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
  }
);

test.concurrent.prop([fc.string({ maxLength: 1, minLength: 1 })])("parseToken - string token escape", (value) => {
  const src = `"\\${value}"`;
  const startIndex = 0;
  const expectedToken = { type: "string", src, value };
  const expectedIndex = 4;
  const expectedErrors = [];

  const [index, token, errors] = parseToken(src, startIndex);

  expect(index).toBe(expectedIndex);
  expect(token).toEqual(expectedToken);
  expect(errors).toEqual(expectedErrors);
});

// Test case: Parsing a number token
test("parseToken - number token", () => {
  const src = "123.45";
  const startIndex = 0;
  const expectedToken = {
    type: "number",
    src: "123.45",
  };
  const expectedIndex = 6;
  const expectedErrors = [];

  const [index, token, errors] = parseToken(src, startIndex);

  expect(index).toBe(expectedIndex);
  expect(token).toEqual(expectedToken);
  expect(errors).toEqual(expectedErrors);
});

// Test case: Parsing a whitespace token
test.concurrent.prop([fc.string({ minLength: 1 }).filter((s) => !s.match(/[^\s]/))])(
  "parseToken - whitespace and newline token",
  (src) => {
    const startIndex = 0;
    const expectedToken = {
      type: src.includes("\n") ? "newline" : "whitespace",
      src,
    } satisfies Token;
    const expectedIndex = src.length;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
  }
);

// Test case: Parsing an identifier token
test("parseToken - identifier token", () => {
  const src = "variable123";
  const startIndex = 0;
  const expectedToken = {
    type: "identifier",
    src: "variable123",
  };
  const expectedIndex = src.length;
  const expectedErrors = [];

  const [index, token, errors] = parseToken(src, startIndex);

  expect(index).toBe(expectedIndex);
  expect(token).toEqual(expectedToken);
  expect(errors).toEqual(expectedErrors);
});

// Test case: Parsing tokens from a source string
test("parseTokens", () => {
  const src = '42 "Hello" variable';
  const startIndex = 0;
  const expectedTokens = [
    {
      type: "number",
      src: "42",
    },
    {
      type: "string",
      src: '"Hello"',
      value: "Hello",
    },
    {
      type: "identifier",
      src: "variable",
    },
  ];
  const expectedIndex = src.length;
  const expectedErrors = [];

  const [index, tokens, errors] = parseTokens(src, startIndex);

  expect(index).toBe(expectedIndex);
  expect(tokens).toEqual(expectedTokens);
  expect(errors).toEqual(expectedErrors);
});

// Add more test cases to cover different scenarios and edge cases
