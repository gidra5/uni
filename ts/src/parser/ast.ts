import { endOfTokensError, error } from "../errors";
import Iterator from "../iterator";
import { indexPosition, position } from "../position";
import { parseTokens } from "../tokens";
import { DefaultVisitor, Tree, Visitor } from "../tree";
import { isEqual } from "../utils";
import { ParsingError, TokenParser } from "./types";

export type Precedence = [prefix: number | null, postfix: number | null];
const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.value && scope[node.value].precedence) || [null, null];

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
export const defaultParsingContext = (): ParsingContext => ({
  scope: {},
  precedence: 0,
});

export type AbstractSyntaxTree = Tree & { value?: string };

export const placeholder = (): AbstractSyntaxTree => ({
  name: "placeholder",
  children: [],
});
export const name = (value: string): AbstractSyntaxTree => ({
  name: "name",
  value,
  children: [],
});
export const group = (
  value?: string,
  children: AbstractSyntaxTree[] = []
): AbstractSyntaxTree => ({
  name: "group",
  value,
  children,
});
export const infix = (
  ...children: [
    group: AbstractSyntaxTree,
    lhs: AbstractSyntaxTree,
    rhs: AbstractSyntaxTree
  ]
): AbstractSyntaxTree => ({
  name: "infix",
  children,
});
export const postfix = (
  ...children: [group: AbstractSyntaxTree, lhs: AbstractSyntaxTree]
): AbstractSyntaxTree => ({
  name: "postfix",
  children,
});
export const prefix = (
  ...children: [group: AbstractSyntaxTree, rhs: AbstractSyntaxTree]
): AbstractSyntaxTree => ({
  name: "prefix",
  children,
});

export const parseGroup =
  (
    context: ParsingContext,
    scope = context.scope
  ): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    const matchingScope = Iterator.iterEntries(scope)
      .filter(([_, { separators }]) => src[index].src === separators[0])
      .filter(([_, { precedence }]) => {
        return precedence[0] === null || precedence[0] >= context.precedence;
      })
      .filter(([_, { precedence }]) => {
        if (context.lhs) return precedence[0] !== null;
        return precedence[0] === null;
      });

    if (matchingScope.isEmpty()) {
      errors.push(error("Unexpected token", indexPosition(index)));
      return [index + 1, group(), errors];
    }

    const matchingScopeIsSingleSep = matchingScope
      .map(([_, { separators }]) => separators.length === 1)
      .every();

    if (matchingScopeIsSingleSep) {
      if (!matchingScope.skip(1).isEmpty()) {
        errors.push(error("Ambiguous name", indexPosition(index)));
      }

      return [index + 1, name(src[index].src), errors];
    }

    index++;
    if (src[index].type === "newline") index++;

    const [nextIndex, expr, _errors] = parseExpr(context)(src, index);
    if (_errors.length > 0) {
      errors.push(
        error("Errors in operand", position(index, nextIndex), _errors)
      );
    }
    index = nextIndex;
    if (src[index].type === "newline") index++;

    const _scope = matchingScope
      .spreadMap((k, v) => {
        const entry = [k, { ...v, separators: v.separators.slice(1) }];
        return entry as [key: string, value: TokenGroupDefinition];
      })
      .toObject();

    const [nextIndex2, rest, _errors2] = parseGroup(context, _scope)(
      src,
      index
    );
    errors.push(..._errors2);
    index = nextIndex2;

    return [index, { ...rest, children: [expr, ...rest.children] }, errors];
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

type TemplateValues = AbstractSyntaxTree[] | Record<string, AbstractSyntaxTree>;
export const template = (tree: AbstractSyntaxTree, values: TemplateValues) => {
  const visitor: Visitor<Tree, AbstractSyntaxTree> = new Visitor<
    Tree,
    AbstractSyntaxTree
  >({
    [DefaultVisitor]: (tree) => {
      const children = visitor.visitChildren(tree).toArray();
      return { ...tree, children };
    },
    placeholder: (tree) => {
      return (values as any[]).pop() ?? tree;
    },
    name: (tree) => {
      return values[tree.value as string] ?? tree;
    },
  });
  return visitor.visitNode(tree);
};

export const match = (
  tree: AbstractSyntaxTree,
  pattern: AbstractSyntaxTree,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  type ReturnType = [boolean, Record<string, AbstractSyntaxTree>];
  const visitor: Visitor<ReturnType, AbstractSyntaxTree> = new Visitor({
    [DefaultVisitor]: (pattern) => {
      if (tree.name !== pattern.name) return [false, matches];
      if (tree.children.length !== pattern.children.length)
        return [false, matches];
      return Iterator.iter(tree.children)
        .zip(pattern.children)
        .reduce<ReturnType>(
          (acc, args) => {
            const [result, matches] = acc;
            const [nextResult, newMatches] = match(...args, matches);
            return [result && nextResult, newMatches];
          },
          [true, matches]
        );
    },
    placeholder: () => [true, matches] as ReturnType,
    name: (pattern: AbstractSyntaxTree): ReturnType => {
      const name = pattern.value as string;
      if (name in matches) {
        return [isEqual(tree, matches[name]), matches];
      }
      return [true, { ...matches, [name]: tree }];
    },
  });
  return visitor.visitNode(pattern);
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [tokens] = parseTokens(templateStr);
  const [parsed] = parse(tokens);
  return template(parsed, values);
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  const [patternTokens] = parseTokens(pattern);
  const [patternParsed] = parse(patternTokens);
  return match(tree, patternParsed, matches);
};
