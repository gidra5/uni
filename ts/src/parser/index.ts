import { endOfTokensError, error } from "../errors";
import { Iterator, spread } from "iterator-js";
import { indexPosition, position } from "../position";
import { AbstractSyntaxTree, group, infix, postfix, prefix } from "./ast";
import { ParsingError, TokenParser } from "./types";

export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: string[];
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;
export type ParsingContext = {
  scope: Scope;
  precedence: number;
  lhs?: AbstractSyntaxTree;
};

const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.value && scope[node.value].precedence) || [null, null];

export const defaultParsingContext = (): ParsingContext => ({
  scope: {},
  precedence: 0,
});

export const parseGroup =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    const matchingScope = Iterator.iterEntries(context.scope)
      .filter(([_, { separators }]) => src[index].src === separators[0])
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

    const matchingScopeIsSingleSep = matchingScope
      .map(([_, { separators }]) => separators.length === 1)
      .every();

    if (matchingScopeIsSingleSep) {
      if (!matchingScope.skip(1).isEmpty()) {
        errors.push(error("Ambiguous name", indexPosition(index)));
      }
      const [name] = matchingScope.first()!;

      return [index + 1, group(name), errors];
    }

    index++;
    if (src[index].type === "newline") index++;

    const _context = { ...context, precedence: 0 };
    _context.lhs = undefined;

    const [nextIndex, expr, _errors] = parseExpr(_context)(src, index);
    if (_errors.length > 0) {
      errors.push(
        error("Errors in operand", position(index, nextIndex), _errors)
      );
    }
    index = nextIndex;
    if (src[index].type === "newline") index++;

    const _scope = matchingScope
      .mapValues((v) => {
        const separators = v.separators.slice(1);
        const precedence = [null, v.precedence[1]] as Precedence;
        return { precedence, separators } as TokenGroupDefinition;
      })
      .filter(spread((_, { separators }) => separators.length > 0))
      .toObject();

    // TODO: how to handle if-then and if-then-else cases?
    const [_index, rest, _errors2] = parseGroup(_context)(src, index);
    errors.push(..._errors2);

    return [_index, { ...rest, children: [expr, ...rest.children] }, errors];
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
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
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

    const lhs = context.lhs;
    context.lhs = undefined;
    return [index, lhs, errors];
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
