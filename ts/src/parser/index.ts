import { endOfTokensError, error } from "../errors";
import { Iterator, spread } from "iterator-js";
import { indexPosition, position } from "../position";
import { AbstractSyntaxTree, group, infix, postfix, prefix } from "./ast";
import { ParsingError, TokenParser } from "./types";
import { matchTokens } from "./utils";
import { RecordEntry } from "iterator-js/dist/types";
export { parseString } from "./utils";

export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: (context: ParsingContext) => TokenParser<"done" | "noMatch" | "match">;
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;
export type ParsingContext = {
  scope: Scope;
  precedence: number;
  lhs?: AbstractSyntaxTree;
  groupNodes?: AbstractSyntaxTree[];
};

const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.value && scope[node.value]?.precedence) || [null, null];

export const defaultParsingContext = (): ParsingContext => ({
  scope: {
    // _: {
    //   separators: () => matchTokens("_"),
    //   precedence: [null, null],
    // },
  },
  precedence: 0,
});

export const parseGroup =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    let matchingScope = Iterator.iterEntries(context.scope)
      .inspect(console.log)
      .filter(([_, { separators }]) => separators(context)(src, index)[1] !== "noMatch")
      .filter(([_, { precedence }]) => {
        return precedence[0] === null || precedence[0] >= context.precedence;
      })
      .filter(([_, { precedence }]) => {
        if (context.lhs) return precedence[0] !== null;
        return precedence[0] === null;
      })
      .cached();

    // TODO: how to handle if-then and if-then-else cases?
    if (matchingScope.isEmpty()) {
      return [index + 1, group(src[index].src), errors];
    }

    const matchingScopeIsSingleSep = matchingScope.every(
      ([_, { separators }]) => separators(context)(src, index)[1] === "done"
    );

    if (matchingScopeIsSingleSep) {
      if (!matchingScope.skip(1).isEmpty()) {
        errors.push(error("Ambiguous name", indexPosition(index)));
      }
      const [name] = matchingScope.first()!;

      return [index + 1, group(name), errors];
    }

    index++;
    if (src[index].type === "newline") index++;

    context = { ...context, precedence: 0, groupNodes: [] };
    context.lhs = undefined;

    while (src[index]) {
      const [nextIndex, expr, _errors] = parseExpr(context)(src, index);
      if (_errors.length > 0) {
        errors.push(error("Errors in operand", position(index, nextIndex), _errors));
      }
      index = nextIndex;
      context.groupNodes!.push(expr);
      if (src[index].type === "newline") index++;

      matchingScope = matchingScope.filterMap(([k, v]) => {
        const [, result] = v.separators(context)(src, index);
        if (result === "noMatch") return;

        return [k, v] as [string, TokenGroupDefinition];
      });

      if (matchingScope.isEmpty()) {
        break;
      }

      if (matchingScope.every(([_, { separators }]) => separators(context)(src, index)[1] === "done")) {
        if (!matchingScope.skip(1).isEmpty()) {
          errors.push(error("Ambiguous name", indexPosition(index)));
        }
        const [name] = matchingScope.first()!;
        index++;
        if (src[index].type === "newline") index++;

        return [index, group(name, ...context.groupNodes!), errors];
      }

      index++;
    }

    return [index, group("name", ...context.groupNodes!), errors];
  };

export const parsePrefix =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    //skip possible whitespace prefix
    if (src[index] && src[index].type === "newline") {
      index++;
    }
    if (!src[index]) errors.push(endOfTokensError(index));

    let [nextIndex, group, _errors] = parseGroup(context)(src, index);
    index = nextIndex;
    errors.push(..._errors);
    const [, right] = getPrecedence(group, context.scope);

    if (right !== null) {
      const _context = { ...context, precedence: right };
      let _errors: ParsingError[];
      let rhs: AbstractSyntaxTree;
      [index, rhs, _errors] = parseExpr(_context)(src, index);
      errors.push(..._errors);
      return [index, prefix(group, rhs), errors];
    }

    return [index, group, errors];
  };

export const parseExpr =
  ({ ...context }: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    let _errors: ParsingError[];
    context.lhs = undefined;
    [index, context.lhs, _errors] = parsePrefix(context)(src, index);
    errors.push(..._errors);

    while (src[index]) {
      //skip possible whitespace prefix
      if (src[index].type === "newline") {
        index++;
        continue;
      }
      let [nextIndex, group, _errors] = parseGroup(context)(src, index);
      errors.push(..._errors);
      if (!group.value) break;
      const [, right] = getPrecedence(group, context.scope);
      index = nextIndex;

      if (right === null) {
        context.lhs = postfix(group, context.lhs);
        break;
      } else {
        const _context = { ...context, precedence: right };
        let _errors: ParsingError[];
        let rhs: AbstractSyntaxTree;
        [index, rhs, _errors] = parseExpr(_context)(src, index);
        errors.push(..._errors);
        context.lhs = infix(group, context.lhs, rhs);
      }
    }

    return [index, context.lhs, errors];
  };

export const parse: TokenParser<AbstractSyntaxTree, true> = (src, i = 0) => {
  const children: AbstractSyntaxTree[] = [];
  const errors: ParsingError[] = [];
  let index = i;
  const context = defaultParsingContext();

  while (src[index]) {
    const [_index, astNode, _errors] = parseExpr(context)(src, index);

    index = _index;
    children.push(astNode);
    errors.push(..._errors);
  }

  return [{ name: "program", children }, []];
};
