import { endOfTokensError, error } from "../errors";
import { Iterator } from "iterator-js";
import { indexPosition, position } from "../position";
import { AbstractSyntaxTree, group, infix, name, number, placeholder, postfix, prefix, string, token } from "./ast";
import { ParsingError, ParsingResult, TokenParser } from "./types";
import { matchSeparators } from "./utils";
import { omit, pushField, setField } from "../utils";

export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: (context: ParsingContext) => TokenParser<"done" | "noMatch" | "match">;
  precedence: Precedence;
  parse?: (context: ParsingContext) => TokenParser<AbstractSyntaxTree>;
  drop?: boolean;
};
export type Scope = Record<string, TokenGroupDefinition>;
export type ScopeArray = ({ name: string } & TokenGroupDefinition)[];
export type ParsingContext = {
  scope: Scope;
  precedence: number;
  lhs?: AbstractSyntaxTree;
  groupNodes?: AbstractSyntaxTree[];
  matchedGroupScope?: Scope;
};

const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.name === "group" && node.value && scope[node.value]?.precedence) || [null, null];

export const infixArithmeticOps = Iterator.iterEntries({
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  modulo: "%",
  power: "^",
});

export const prefixArithmeticOps = Iterator.iterEntries({
  negate: "-",
  decrement: "--",
  increment: "++",
});

export const comparisonOps = Iterator.iter(["<", "<=", ">=", ">"]);
export const scopeIter = (scope: Scope = {}): Iterator<ScopeArray[number]> =>
  Iterator.iterEntries(scope).map(([name, v]) => ({ ...v, name }));
export const scopeIterToScope = (scopeIter: Iterator<ScopeArray[number]>): Scope =>
  scopeIter.map(({ name, ...v }) => [name, v] as [string, TokenGroupDefinition]).toObject();
const scope: Scope = {
  "+": { separators: matchSeparators(["+"]), precedence: [3, 4] },
  "-": { separators: matchSeparators(["-"]), precedence: [3, 4] },
  "*": { separators: matchSeparators(["*"]), precedence: [5, 6] },
  "/": { separators: matchSeparators(["/"]), precedence: [5, 6] },
  "%": { separators: matchSeparators(["%"]), precedence: [5, 6] },
  "^": { separators: matchSeparators(["^"]), precedence: [7, 8] },
  "!": { separators: matchSeparators(["!"]), precedence: [null, 3] },
  ",": { separators: matchSeparators([","]), precedence: [1, 2] },
  in: { separators: matchSeparators(["in"]), precedence: [1, 1] },
  is: { separators: matchSeparators(["is"]), precedence: [1, 1] },
  and: { separators: matchSeparators(["and"]), precedence: [1, 1] },
  or: { separators: matchSeparators(["or"]), precedence: [1, 1] },
  "==": { separators: matchSeparators(["=="]), precedence: [1, 1] },
  "!=": { separators: matchSeparators(["!="]), precedence: [1, 1] },
  not: { separators: matchSeparators(["not"]), precedence: [null, 1] },
  ...comparisonOps
    .map((op) => {
      const definition = { separators: matchSeparators([op]), precedence: [1, 1] };
      return [op, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  ...comparisonOps
    .power(2)
    .map<[string, TokenGroupDefinition]>(([op1, op2]) => {
      const definition = { separators: matchSeparators([op1], [op2]), precedence: [1, 1] };
      return [`inRange_${op1}_${op2}`, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  "->": { separators: matchSeparators(["->"]), precedence: [Infinity, 2] },
  fn: { separators: matchSeparators(["fn"], ["->"]), precedence: [null, 2] },
  ";": { separators: matchSeparators([";", "\n"]), precedence: [1, 1] },
  match: { separators: matchSeparators(["match"], ["{"], ["}"]), precedence: [null, null] },
  matchColon: { separators: matchSeparators(["match"], [":", "\n"]), precedence: [null, 1] },
  if: { separators: matchSeparators(["if"], [":", "\n"]), precedence: [null, 1] },
  ifElse: { separators: matchSeparators(["if"], [":", "\n"], ["else"]), precedence: [null, 1] },
  for: { separators: matchSeparators(["for"], ["in"], [":", "\n"]), precedence: [null, 1] },
  while: { separators: matchSeparators(["while"], [":", "\n"]), precedence: [null, 1] },
  break: { separators: matchSeparators(["break"]), precedence: [null, 1] },
  continue: { separators: matchSeparators(["continue"]), precedence: [null, 1] },
  return: { separators: matchSeparators(["return"]), precedence: [null, 1] },
  "=": { separators: matchSeparators(["="]), precedence: [1, 1] },
  ":=": { separators: matchSeparators([":="]), precedence: [2, 2] },
  record: { separators: matchSeparators(["record"], ["{"], ["}"]), precedence: [null, null] },
  set: { separators: matchSeparators(["set"], ["{"], ["}"]), precedence: [null, null] },
  map: { separators: matchSeparators(["map"], ["{"], ["}"]), precedence: [null, null] },
  access: { separators: matchSeparators(["."]), precedence: [Infinity, Infinity] },
  accessDynamic: { separators: matchSeparators(["["], ["]"]), precedence: [Infinity, null] },
  import: { separators: matchSeparators(["import"], ["as"]), precedence: [null, 1] },
  importWith: { separators: matchSeparators(["import"], ["as"], ["with"]), precedence: [null, 1] },
  use: { separators: matchSeparators(["use"], ["as"]), precedence: [null, 1] },
  useWith: { separators: matchSeparators(["use"], ["as"], ["with"]), precedence: [null, 1] },
  export: { separators: matchSeparators(["export"]), precedence: [null, 1] },
  exportAs: { separators: matchSeparators(["export"], ["as"]), precedence: [null, 1] },
  external: { separators: matchSeparators(["external"]), precedence: [null, 1] },
  label: { separators: matchSeparators([":"]), precedence: [2, 2] },
  negate: {
    separators: matchSeparators(["-"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  postfixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [3, null],
  },
  postfixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [3, null],
  },
  parens: {
    separators:
      (context) =>
      (src, i = 0) => {
        let index = i;
        if (!src[index]) return [i, "noMatch", []];
        if (src[index].src === "(") {
          index++;
          if (src[index]?.type === "newline") index++;
          if (src[index]?.src === ")") return [index + 1, "done", []];
        }
        return matchSeparators(["("], [")"])(context)(src, i);
      },
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
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].type !== "newline") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  commentBlock: {
    separators: matchSeparators(["/*"], ["*/"]),
    precedence: [null, null],
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].src !== "*/") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  application: {
    separators: matchSeparators(),
    precedence: [Infinity, Infinity],
  },
};
export const defaultParsingContext = (): ParsingContext => ({ scope, precedence: 0 });

export const parseGroup =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    console.dir({ msg: "parseGroup", index, src: src[index], context: omit(context, ["scope"]) }, { depth: null });
    // console.dir({ msg: "parseGroup", index, src: src[index], context }, { depth: null });

    if (!src[index]) {
      errors.push(endOfTokensError(index));
      return [index, placeholder(), errors];
    }

    const path = ["groupNodes"];
    const _context = pushField(path, placeholder())(context);
    const nextTokenIsCurrentGroupSeparator =
      context.groupNodes &&
      context.matchedGroupScope &&
      scopeIter(context.matchedGroupScope).some(({ separators }) => separators(_context)(src, index)[1] !== "noMatch");
    if (nextTokenIsCurrentGroupSeparator) return [index, placeholder(), errors];

    context = { ...context, groupNodes: [] };
    const scopeEntries = scopeIter(context.scope);
    let matchingScope = scopeEntries
      // .inspect((x) => console.log(1, x))
      .filter(({ precedence }) => {
        if (context.lhs) return precedence[0] !== null;
        return precedence[0] === null;
      })
      // .inspect((x) => console.log(2, x))
      .filter((x) => {
        const { precedence } = x;
        // console.log(
        //   3,
        //   x,
        //   precedence[0],
        //   context.precedence,
        //   precedence[0] === null || precedence[0] >= context.precedence
        // );

        return precedence[0] === null || precedence[0] >= context.precedence;
      })
      // .inspect((x) => console.log(3, x))
      .filter(({ separators }) => {
        return separators(context)(src, index)[1] !== "noMatch";
      })
      // .inspect((x) => console.log(4, x))
      .cached();

    console.dir(
      {
        msg: "parseGroup 2",
        index,
        src: src[index],
        context: omit(context, ["scope"]),
        matchingScope: matchingScope.toArray(),
        empty: matchingScope.isEmpty(),
      },
      { depth: null }
    );

    if (matchingScope.isEmpty()) {
      const token = src[index];

      const _context = setField(path, [])(context);
      const isStartOfGroup = scopeEntries.some(
        ({ separators, precedence }) => precedence[0] !== null && separators(_context)(src, index)[1] !== "noMatch"
      );
      if (context.lhs && !isStartOfGroup && context.precedence !== Infinity)
        return [index, group("application"), errors];

      if (/^_+$/.test(token.src)) return [index + 1, placeholder(), errors];
      if (token.type === "identifier") return [index + 1, name(token.src), errors];
      if (token.type === "number") return [index + 1, number(token.value), errors];
      if (token.type === "string") return [index + 1, string(token.value), errors];
      // console.log("fuck");
      return [index, placeholder(), errors];
    }

    context = { ...context, precedence: 0, matchedGroupScope: scopeIterToScope(matchingScope) };
    const parsedGroups: ParsingResult<AbstractSyntaxTree>[] = [];

    console.dir({ msg: "parseGroup 3", index, src: src[index], context: omit(context, ["scope"]) }, { depth: null });

    while (src[index]) {
      const [match, done] = matchingScope.partition(({ separators }) => {
        const [, result] = separators(context)(src, index);
        if (result === "match") return 0;
        if (result === "done") return 1;
        return -1;
      });

      console.dir(
        {
          msg: "parseGroup 4",
          index,
          src: src[index],
          context: omit(context, ["scope"]),
          match: match.toArray(),
          done: done.toArray(),
          matchingScope: context.matchedGroupScope,
        },
        { depth: null }
      );

      if (match.count() === 0) {
        if (!matchingScope.skip(1).isEmpty()) {
          errors.push(error("Ambiguous name", indexPosition(index)));
        }
        const { name, separators, drop } = matchingScope.first()!;
        [index] = separators(context)(src, index);
        if (drop) return parseGroup(context)(src, index);
        // if (src[index]?.type === "newline") index++;

        return [index, group(name, ...context.groupNodes!), errors];
      }

      parsedGroups.push(
        ...done.map<ParsingResult<AbstractSyntaxTree>>(({ name, separators }) => {
          const [_index] = separators(context)(src, index);
          return [_index, group(name, ...context.groupNodes!), [...errors]];
        })
      );

      index++;
      const parser = matchingScope.first()?.parse ?? parseExpr;
      const [nextIndex, expr, _errors] = parser(context)(src, index);

      // console.dir(
      //   {
      //     msg: "parseGroup 5",
      //     index,
      //     src: src[index],
      //     context: omit(context, ["scope"]),
      //     match: match.toArray(),
      //     done: done.toArray(),
      //     matchingScope: context.matchedGroupScope,
      //     res: [nextIndex, expr, _errors],
      //   },
      //   { depth: null }
      // );

      if (_errors.length > 0) {
        errors.push(error("Errors in operand", position(index, nextIndex), _errors));
      }
      index = nextIndex;
      context.groupNodes!.push(expr);
      const nextTokenIsCurrentGroupSeparator = matchingScope.some(
        ({ separators }) => separators(context)(src, index)[1] !== "noMatch"
      );

      // console.dir(
      //   {
      //     msg: "parseGroup 6",
      //     index,
      //     nextTokenIsCurrentGroupSeparator,
      //     src: src[index],
      //     context: omit(context, ["scope"]),
      //     match: match.toArray(),
      //     done: done.toArray(),
      //     matchingScope: context.matchedGroupScope,
      //   },
      //   { depth: null }
      // );
      if (!nextTokenIsCurrentGroupSeparator && src[index]?.type === "newline") index++;

      matchingScope = matchingScope
        .filter(({ separators }) => {
          return separators(context)(src, index)[1] !== "noMatch";
        })
        .cached();
      context.matchedGroupScope = scopeIterToScope(matchingScope);

      // console.dir(
      //   {
      //     msg: "parseGroup 7",
      //     index,
      //     nextTokenIsCurrentGroupSeparator,
      //     src: src[index],
      //     context: omit(context, ["scope"]),
      //     match: match.toArray(),
      //     done: done.toArray(),
      //     matchingScope: context.matchedGroupScope,
      //   },
      //   { depth: null }
      // );

      if (matchingScope.isEmpty()) {
        if (parsedGroups.length > 0) {
          return parsedGroups.pop()!;
        }

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

    console.dir({
      msg: "parsePrefix 1",
      index,
      src: src[index],
      context: omit(context, ["scope"]),
      res: [nextIndex, group, _errors],
      right,
    });

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
    // console.dir({ msg: "parseExpr 1", index, src: src[index], context: omit(context, ["scope"]) });

    [index, context.lhs, _errors] = parsePrefix(context)(src, index);
    errors.push(..._errors);

    while (src[index]) {
      //skip possible whitespace prefix
      // if (src[index].type === "newline") {
      //   index++;
      //   continue;
      // }
      // console.dir({ msg: "parseExpr 2", index, src: src[index], context: omit(context, ["scope"]) });

      let [nextIndex, group, _errors] = parseGroup(context)(src, index);
      // console.dir({
      //   msg: "parseExpr 3",
      //   index,
      //   src: src[index],
      //   context: omit(context, ["scope"]),
      //   res: [nextIndex, group, _errors],
      //   break: group.value === undefined || group.name !== "group",
      // });

      errors.push(..._errors);
      const [left, right] = getPrecedence(group, context.scope);
      if (left === null) break;
      index = nextIndex;

      if (right === null) {
        context.lhs = postfix(group, context.lhs);
        break;
      }
      let _context = { ...context, precedence: right };

      let rhs: AbstractSyntaxTree;
      // console.dir({ msg: "parseExpr 4", index, src: src[index], context });

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
