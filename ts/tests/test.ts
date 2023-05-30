import { describe, it, test } from "node:test";
import fc from "fast-check";
import {
  parseTokensToOperator,
  OperatorDefinition,
  ScopeGenerator,
  Scope,
  OperatorInstance,
} from "../src/parser/new.js";
import { assert } from "../src/utils.js";
import { deepStrictEqual } from "node:assert";

fc.configureGlobal({
  numRuns: 1,
  timeout: 10 * 1000,
  interruptAfterTimeLimit: 60 * 1000,
  skipAllAfterTimeLimit: 20 * 1000,
});

// Properties
describe("parse operator", () => {
  const operatorDefArb = fc.letrec<{
    def: OperatorDefinition;
    scope: ScopeGenerator;
  }>((tie) => ({
    def: fc.record({
      separators: fc
        .array(
          fc.record({
            tokens: fc.array(fc.string({ minLength: 1, size: "xsmall" }), {
              minLength: 1,
              size: "xsmall",
            }),
            repeats: fc
              .tuple(fc.nat(), fc.nat())
              .filter(([min, max]) => 0 < min && min <= max),
            scope: tie("scope"),
          }),
          { minLength: 1, size: "xsmall" }
        )
        .filter((separators) => separators[0].repeats[0] > 0),
    }),
    scope: fc.option(
      fc.func(
        fc.oneof(
          { maxDepth: 1, withCrossShrink: true },
          fc.constant({}),
          fc.dictionary(fc.uuid(), tie("def"), { size: "xsmall" })
        )
      ),
      { maxDepth: 1 }
    ),
  })).def;

  const inputArb = fc
    .tuple(fc.string({ minLength: 1 }), fc.nat())
    .filter(([s, i]) => i >= 0 && i <= s.length);

  it("should always end within source bounds", () =>
    fc.assert(
      fc.property(
        inputArb,
        operatorDefArb,
        fc.dictionary(fc.uuid(), operatorDefArb),
        ([src, index], op, scope) => {
          const [_index] = parseTokensToOperator(src, index, op, scope);
          assert(_index >= index);
          assert(_index <= src.length);
        }
      )
    ));

  describe("when no errors", () => {
    const argsArbNoError = fc
      .tuple(inputArb, operatorDefArb, fc.dictionary(fc.uuid(), operatorDefArb))
      .map(
        ([[src, index], op, scope]) =>
          [
            parseTokensToOperator(src, index, op, scope),
            [src, index, op, scope] as const,
          ] as const
      )
      .filter(([[, , errors]]) => errors.length === 0);
    it("should always have children within bounds of separators repetition sum", () => {
      fc.assert(
        fc.property(argsArbNoError, ([[, result], [, , op]]) => {
          const min = op.separators.reduce(
            (acc, { repeats: [min] }) => acc + min,
            0
          );
          const max = op.separators.reduce(
            (acc, { repeats: [, max] }) => acc + max,
            0
          );
          const count = result.children.length;

          assert(count >= min);
          assert(count <= max);
        })
      );
    });

    it("should always have children ordered in ascending order of separator index", () => {
      fc.assert(
        fc.property(argsArbNoError, ([[, result]]) => {
          const { children } = result;

          assert(
            children.every(({ separatorIndex: index1 }, i, array) => {
              const rest = array.slice(i + 1);
              return rest.every(
                ({ separatorIndex: index2 }) => index1 <= index2
              );
            })
          );
        })
      );
    });

    it("sep-index and sep-token should match with sep-definition", () => {
      fc.assert(
        fc.property(argsArbNoError, ([[, result], [, , op]]) => {
          const { children } = result;

          assert(
            children.every(
              ({ separatorIndex: index, separatorToken: token }) => {
                const sepDef = op.separators[index];
                return sepDef.tokens.includes(token);
              }
            )
          );
        })
      );
    });
  });
});

test("test cases", () => {
  const input = "(a, b, c, 123; (d,e, f   ,g)) ? a : (b)";
  const expect: OperatorInstance = {
    token: "(",
    children: [
      { children: ["a"], separatorIndex: 1, separatorToken: "," },
      { children: [" b"], separatorIndex: 1, separatorToken: "," },
      { children: [" c"], separatorIndex: 1, separatorToken: "," },
      { children: [" 123"], separatorIndex: 1, separatorToken: ";" },
      {
        children: [
          " ",
          {
            token: "(",
            id: "id1",
            children: [
              { children: ["d"], separatorIndex: 1, separatorToken: "," },
              { children: ["e"], separatorIndex: 1, separatorToken: "," },
              { children: [" f   "], separatorIndex: 1, separatorToken: "," },
              { children: ["g"], separatorIndex: 2, separatorToken: ")" },
            ],
          },
        ],
        separatorIndex: 2,
        separatorToken: ")",
      },
    ],
  };
  const scope: Scope = {
    id1: {
      separators: [
        { tokens: ["("], repeats: [1, 1] },
        { tokens: [",", ";"], repeats: [0, Infinity] },
        { tokens: [")"], repeats: [1, 1] },
      ],
    },
    id2: {
      separators: [
        { tokens: ["?"], repeats: [1, 1] },
        { tokens: [":"], repeats: [1, 1] },
      ],
    },
  };
  const [index, instance, errors] = parseTokensToOperator(
    input,
    0,
    scope["id1"],
    scope
  );

  assert(index === 29);
  assert(errors.length === 0);
  deepStrictEqual(instance, expect);
  const expect2: OperatorInstance = {
    token: "?",
    children: [{ children: [" a "], separatorIndex: 1, separatorToken: ":" }],
  };
  const [index2, instance2, errors2] = parseTokensToOperator(
    input,
    index + 1,
    scope["id2"],
    scope
  );

  assert(errors2.length === 0);
  deepStrictEqual(instance2, expect2);
  assert(index2 === index + 6);
  const expect3: OperatorInstance = {
    token: "(",
    children: [{ children: ["b"], separatorIndex: 2, separatorToken: ")" }],
  };
  const [index3, instance3, errors3] = parseTokensToOperator(
    input,
    index2 + 1,
    scope["id1"],
    scope
  );

  assert(errors3.length === 0);
  deepStrictEqual(instance3, expect3);
  assert(index3 === index2 + 4);
});
