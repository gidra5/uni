import { describe, it } from "node:test";
import fc from "fast-check";
import { parseOperator, OperatorDef } from "../src/parser/new.js";
import { assert } from "../src/utils.js";

// Properties
describe("parseOperator", () => {
  const operatorDefArb = fc.letrec<{ def: OperatorDef }>((tie) => ({
    def: fc.record({
      separators: fc
        .array(
          fc.record({
            tokens: fc.array(fc.string()),
            repeat: fc
              .tuple(fc.nat(), fc.nat())
              .filter(([min, max]) => 0 < min && min <= max),
            scope: fc.func(fc.dictionary(fc.uuid(), tie("def"))),
          }),
          { minLength: 1 }
        )
        .filter((separators) => separators[0].repeat[0] > 0),
      scope: fc.func(fc.dictionary(fc.uuid(), tie("def"))),
    }),
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
          const [_index] = parseOperator(src, index, op, scope);
          assert(_index >= index);
          assert(_index <= src.length);
        }
      )
    ));

  describe("when no errors", () => {
    it("should always have children within bounds of separators repetition sum", () => {
      fc.assert(
        fc.property(
          inputArb,
          operatorDefArb,
          fc.dictionary(fc.uuid(), operatorDefArb),
          ([src, index], op, scope) => {
            const [_index, result, errors] = parseOperator(
              src,
              index,
              op,
              scope
            );
            fc.pre(errors.length === 0);
            const min = op.separators.reduce(
              (acc, { repeat: [min] }) => acc + min,
              0
            );
            const max = op.separators.reduce(
              (acc, { repeat: [max] }) => acc + max,
              0
            );
            const count = result.children.length;

            assert(count >= min);
            assert(count <= max);
          }
        )
      );
    });

    it("should always have children ordered in ascending order of separator index", () => {
      fc.assert(
        fc.property(
          inputArb,
          operatorDefArb,
          fc.dictionary(fc.uuid(), operatorDefArb),
          ([src, index], op, scope) => {
            const [_index, result, errors] = parseOperator(
              src,
              index,
              op,
              scope
            );
            fc.pre(errors.length === 0);
            const { children } = result;

            assert(
              children.every(({ separatorIndex: index1 }, i, array) => {
                const rest = array.slice(i + 1);
                return rest.every(
                  ({ separatorIndex: index2 }) => index1 <= index2
                );
              })
            );
          }
        )
      );
    });

    it("sep-index and sep-token should match with sep-definition", () => {
      fc.assert(
        fc.property(
          inputArb,
          operatorDefArb,
          fc.dictionary(fc.uuid(), operatorDefArb),
          ([src, index], op, scope) => {
            const [_index, result, errors] = parseOperator(
              src,
              index,
              op,
              scope
            );
            fc.pre(errors.length === 0);
            const { children } = result;

            assert(
              children.every(
                ({ separatorIndex: index, separatorToken: token }) => {
                  const sepDef = op.separators[index];
                  return sepDef.tokens.includes(token);
                }
              )
            );
          }
        )
      );
    });

    it("sep-repeat is within bounds of sep-definition-repeat", () => {
      fc.assert(
        fc.property(
          inputArb,
          operatorDefArb,
          fc.dictionary(fc.uuid(), operatorDefArb),
          ([src, index], op, scope) => {
            const [_index, result, errors] = parseOperator(
              src,
              index,
              op,
              scope
            );
            fc.pre(errors.length === 0);
            const { children } = result;

            assert(
              op.separators.every(({ repeat }, i) => {
                const repeats = children.filter(
                  ({ separatorIndex }) => separatorIndex === i
                ).length;
                return repeat[0] <= repeats && repeats <= repeat[1];
              })
            );
          }
        )
      );
    });
  });
});
