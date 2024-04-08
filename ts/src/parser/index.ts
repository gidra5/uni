import { endOfTokensError, error } from "../errors.js";
import { Iterator } from "iterator-js";
import { indexPosition, position } from "../position.js";
import {
  AbstractSyntaxTree,
  group,
  infix,
  error as errorNode,
  placeholder,
  postfix,
  prefix,
  program,
  token,
} from "./ast.js";
import { ParsingError, ParsingResult, Precedence, TokenParser } from "./types.js";
import { pushField, setField } from "../utils/index.js";
import { scope } from "./constants.js";
import { Scope as ScopeClass } from "../scope.js";

export type ASTTransformer = (ast: AbstractSyntaxTree) => [AbstractSyntaxTree, ParsingError[]];
export type TokenGroupDefinition = {
  separators: TokenParserWithContext<"done" | "noMatch" | "match">;
  precedence: Precedence;
  transform?: ASTTransformer;
  parse?: TokenParserWithContext<AbstractSyntaxTree>;
  drop?: boolean;
};
export type Scope = ScopeClass<TokenGroupDefinition>;
export type ScopeArray = ({ name: string | symbol } & TokenGroupDefinition)[];
export type ParsingContext = {
  scope: Scope;
  precedence: number;
  lhs?: AbstractSyntaxTree;
  groupNodes?: AbstractSyntaxTree[];
  matchedGroupScope?: Scope;
};
export type TokenParserWithContext<T> = (context: ParsingContext) => TokenParser<T>;

const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.name === "operator" && node.value && scope.getByName(node.value)?.value.precedence) || [null, null];

export const scopeIter = (scope: Scope = new ScopeClass()): Iterator<ScopeArray[number]> =>
  scope.iterEntries().map(({ name, value }) => ({ name, ...value }));
export const scopeIterToScope = (scopeIter: Iterator<ScopeArray[number]>): Scope =>
  new ScopeClass(scopeIter.map(({ name, ...v }) => [name, v] as [string, TokenGroupDefinition]).toObject());
export const defaultParsingContext = (): ParsingContext => ({ scope, precedence: 0 });

export const parseGroup: TokenParserWithContext<AbstractSyntaxTree> =
  (context) =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    // console.dir({ msg: "parseGroup", index, src: src[index], context: omit(context, ["scope"]) }, { depth: null });
    // console.dir({ msg: "parseGroup", index, src: src[index], context }, { depth: null });

    if (!src[index]) {
      errors.push(endOfTokensError(index));
      return [index, errorNode(), errors];
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

        return precedence[0] === null || precedence[0] > context.precedence;
      })
      // .inspect((x) => console.log(3, x))
      .filter(({ separators }) => {
        return separators(context)(src, index)[1] !== "noMatch";
      })
      // .inspect((x) => console.log(4, x))
      .cached();

    // console.dir(
    //   {
    //     msg: "parseGroup 2",
    //     index,
    //     src: src[index],
    //     context: omit(context, ["scope"]),
    //     // context,
    //     matchingScope: matchingScope.toArray(),
    //     empty: matchingScope.isEmpty(),
    //   },
    //   { depth: null }
    // );

    if (matchingScope.isEmpty()) {
      const _token = src[index];

      const _context = setField(path, [])(context);
      const applicationPrecedence = scope.getByName("application")!.value.precedence;
      const isStartOfGroup = scopeEntries.some(
        ({ separators, precedence }) => precedence[0] !== null && separators(_context)(src, index)[1] !== "noMatch"
      );
      if (context.lhs && !isStartOfGroup && applicationPrecedence[0]! > context.precedence)
        return [index, group("application"), errors];

      if (_token.type === "newline") return [index, placeholder(), errors];
      return [index + 1, token(_token), errors];
    }

    context = { ...context, precedence: 0, matchedGroupScope: scopeIterToScope(matchingScope) };
    const parsedGroups: ParsingResult<AbstractSyntaxTree>[] = [];

    // console.dir({ msg: "parseGroup 3", index, src: src[index], context: omit(context, ["scope"]) }, { depth: null });

    while (src[index]) {
      const [match, done] = matchingScope.partition(({ separators }) => {
        const [, result] = separators(context)(src, index);
        if (result === "match") return 0;
        if (result === "done") return 1;
        return -1;
      });

      // console.dir(
      //   {
      //     msg: "parseGroup 4",
      //     index,
      //     src: src[index],
      //     context: omit(context, ["scope"]),
      //     match: match.toArray(),
      //     done: done.toArray(),
      //     matchingScope: context.matchedGroupScope,
      //   },
      //   { depth: null }
      // );

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
        .filter(({ separators }) => separators(context)(src, index)[1] !== "noMatch")
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
        return [index, errorNode(), errors];
      }
    }

    errors.push(endOfTokensError(index));
    return [index, errorNode(), errors];
  };

export const parsePrefix: TokenParserWithContext<AbstractSyntaxTree> =
  ({ ...context }) =>
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

    // console.dir({
    //   msg: "parsePrefix 1",
    //   index,
    //   src: src[index],
    //   context: omit(context, ["scope"]),
    //   res: [nextIndex, group, _errors],
    //   right,
    // });

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

export const parseExpr: TokenParserWithContext<AbstractSyntaxTree> =
  ({ ...context }) =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    let _errors: ParsingError[];
    // console.dir(
    //   {
    //     msg: "parseExpr 1",
    //     index,
    //     src: src[index],
    //     context: omit(context, ["scope", "lhs"]),
    //     lhs: context.lhs && omitASTDataScope(context.lhs),
    //   },
    //   { depth: null }
    // );

    [index, context.lhs, _errors] = parsePrefix(context)(src, index);
    errors.push(..._errors);

    while (src[index]) {
      //skip possible whitespace prefix
      // if (src[index].type === "newline") {
      //   index++;
      //   continue;
      // }
      // console.dir(
      //   {
      //     msg: "parseExpr 2",
      //     index,
      //     src: src[index],
      //     context: omit(context, ["scope", "lhs"]),
      //     lhs: context.lhs && omitASTDataScope(context.lhs),
      //   },
      //   { depth: null }
      // );

      let [nextIndex, group, _errors] = parseGroup(context)(src, index);
      // console.dir(
      //   {
      //     msg: "parseExpr 3",
      //     index,
      //     src: src[index],
      //     context: omit(context, ["scope", "lhs"]),
      //     lhs: context.lhs && omitASTDataScope(context.lhs),
      //     res: [nextIndex, omitASTDataScope(group), _errors],
      //     break: group.value === undefined || group.name !== "group",
      //     precedence: getPrecedence(group, context.scope),
      //   },
      //   { depth: null }
      // );

      errors.push(..._errors);
      const [left, right] = getPrecedence(group, context.scope);
      if (left === null) break;
      index = nextIndex;

      if (right === null) {
        context.lhs = postfix(group, context.lhs);
        continue;
      }
      let _context = { ...context, precedence: right };

      let rhs: AbstractSyntaxTree;
      // console.dir({
      //   msg: "parseExpr 4",
      //   index,
      //   src: src[index],
      //   context: omit(context, ["scope", "lhs"]),
      //   lhs: context.lhs && omitASTDataScope(context.lhs),
      //   group: omitASTDataScope(group),
      // });

      [index, rhs, _errors] = parseExpr(_context)(src, index);
      errors.push(..._errors);

      // console.dir({
      //   msg: "parseExpr 5",
      //   index,
      //   src: src[index],
      //   context,
      //   group,
      //   res: [index, rhs, _errors],
      //   precedence: [left, right],
      // });

      // if two same operators are next to each other, and their precedence is the same on both sides - it is both left and right associative
      // which means we can put all arguments into one group
      if (left === right && group.value === context.lhs.value) {
        context.lhs.children.push(rhs);
      } else {
        context.lhs = infix(group, context.lhs, rhs);
      }
    }

    if (context.lhs.name === "operator" && context.scope.getByName(context.lhs.value)) {
      const def = context.scope.getByName(context.lhs.value)!.value;
      if (def.transform) {
        const [transformed, _errors] = def.transform(context.lhs);
        errors.push(..._errors);
        context.lhs = transformed;
      }
    }

    return [index, context.lhs, errors];
  };

export const parse =
  (context = defaultParsingContext()): TokenParser<AbstractSyntaxTree, true> =>
  (src, i = 0) => {
    const children: AbstractSyntaxTree[] = [];
    const errors: ParsingError[] = [];
    let index = i;

    while (src[index]) {
      const [_index, astNode, _errors] = parseExpr(context)(src, index);

      index = _index;
      children.push(astNode);
      errors.push(..._errors);
    }

    return [program(...children), []];
  };
