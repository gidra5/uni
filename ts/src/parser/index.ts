import { endOfTokensError, error } from "../errors";
import { Iterator, spread } from "iterator-js";
import { indexPosition, position } from "../position";
import {
  AbstractSyntaxTree,
  group,
  infix,
  name,
  number,
  placeholder,
  postfix,
  prefix,
  string,
} from "./ast";
import { ParsingError, TokenParser } from "./types";
import { matchSeparators } from "./utils";
import { RecordEntry } from "iterator-js/dist/types";
import { pushField, setField } from "../utils";
export { parseString } from "./utils";

export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: (
    context: ParsingContext
  ) => TokenParser<"done" | "noMatch" | "match">;
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
    "+": { separators: matchSeparators(["+"]), precedence: [1, 2] },
    "-": { separators: matchSeparators(["-"]), precedence: [1, 2] },
    "*": { separators: matchSeparators(["*"]), precedence: [3, 4] },
    "/": { separators: matchSeparators(["/"]), precedence: [3, 4] },
    "^": { separators: matchSeparators(["^"]), precedence: [5, 6] },
    "!": { separators: matchSeparators(["!"]), precedence: [null, 1] },
    ",": { separators: matchSeparators([","]), precedence: [1, 1] },
    "->": { separators: matchSeparators(["->"]), precedence: [1, 1] },
    negate: { separators: matchSeparators(["-"]), precedence: [null, 1] },
    prefixDecrement: {
      separators: matchSeparators(["--"]),
      precedence: [null, 1],
    },
    prefixIncrement: {
      separators: matchSeparators(["++"]),
      precedence: [null, 1],
    },
    postfixDecrement: {
      separators: matchSeparators(["--"]),
      precedence: [1, null],
    },
    postfixIncrement: {
      separators: matchSeparators(["++"]),
      precedence: [1, null],
    },
    parens: {
      separators: matchSeparators(["("], [")"]),
      precedence: [null, null],
    },
    brackets: {
      separators: matchSeparators(["["], ["]"]),
      precedence: [null, null],
    },
    braces: {
      separators: matchSeparators(["{"], ["}"]),
      precedence: [null, null],
    },
    comment: {
      separators: matchSeparators(["//"], ["\n"]),
      precedence: [null, null],
    },
    commentBlock: {
      separators: matchSeparators(["/*"], ["*/"]),
      precedence: [null, null],
    },
    application: {
      separators: matchSeparators(),
      precedence: [Infinity, Infinity],
    },
  },
  precedence: 0,
});

export const parseGroup =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    const scopeEntries = Iterator.iterEntries(context.scope);
    let matchingScope = scopeEntries
      .filter(([_, { precedence }]) => {
        return precedence[0] === null || precedence[0] >= context.precedence;
      })
      .filter(([_, { precedence }]) => {
        if (context.lhs) return precedence[0] !== null;
        return precedence[0] === null;
      })
      .filter(([_, { separators }]) => {
        return separators(context)(src, index)[1] !== "noMatch";
      })
      .cached();

    if (matchingScope.isEmpty()) {
      const token = src[index];
      console.dir({ msg: "parseGroup unmatched", index, token, context });

      if (context.lhs) {
        // if (!context.groupNodes) return [index, group("application"), errors];
        // if (context.lhs.name !== "infix") {
        //   const path = ["groupNodes"];
        //   const _context = pushField(path, placeholder())(context);
        //   const nextTokenIsCurrentGroupSeparator = scopeEntries.some(
        //     ([_, { separators }]) =>
        //       separators(_context)(src, index)[1] !== "noMatch"
        //   );
        //   if (!nextTokenIsCurrentGroupSeparator)
        //     return [index, group("application"), errors];
        // }
        return [index, placeholder(), errors];
      }

      if (!token) {
        errors.push(endOfTokensError(index));
        return [index, placeholder(), errors];
      }
      if (token.src === "_") return [index + 1, placeholder(), errors];
      if (token.type === "identifier")
        return [index + 1, name(token.src), errors];
      if (token.type === "number")
        return [index + 1, number(token.value), errors];
      if (token.type === "string")
        return [index + 1, string(token.value), errors];
    }

    context = { ...context, precedence: 0, groupNodes: [] };
    context.lhs = undefined;

    while (src[index]) {
      if (
        matchingScope.every(
          ([_, { separators }]) => separators(context)(src, index)[1] === "done"
        )
      ) {
        if (!matchingScope.skip(1).isEmpty()) {
          errors.push(error("Ambiguous name", indexPosition(index)));
        }
        const [name] = matchingScope.first()!;
        index++;
        if (src[index]?.type === "newline") index++;

        return [index, group(name, ...context.groupNodes!), errors];
      }

      index++;

      const [nextIndex, expr, _errors] = parseExpr(context)(src, index);
      if (_errors.length > 0) {
        errors.push(
          error("Errors in operand", position(index, nextIndex), _errors)
        );
      }
      index = nextIndex;
      context.groupNodes!.push(expr);
      if (src[index]?.type === "newline") index++;

      matchingScope = matchingScope
        .filterMap(([k, v]) => {
        const [, result] = v.separators(context)(src, index);
        if (result === "noMatch") return;

        return [k, v] as [string, TokenGroupDefinition];
        })
        .cached();

      if (matchingScope.isEmpty()) {
        errors.push(error("unterminated group", indexPosition(index)));
        return [index, placeholder(), errors];
      }
    }

    errors.push(endOfTokensError(index));
    return [index, placeholder(), errors];
  };

export const parsePrefix =
  ({ ...context }: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    context.lhs = undefined;
    let index = i;
    const errors: ParsingError[] = [];
    //skip possible whitespace prefix
    if (src[index]?.type === "newline") {
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
      }
      let _context = { ...context, precedence: right };
      // _context.lhs = infix(group, context.lhs, placeholder());

      let rhs: AbstractSyntaxTree;
      [index, rhs, _errors] = parseExpr(_context)(src, index);
      errors.push(..._errors);
      context.lhs = infix(group, context.lhs, rhs);
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
