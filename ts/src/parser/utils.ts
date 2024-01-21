import {
  ParsingContext,
  Scope,
  defaultParsingContext,
  parse,
  parseExpr,
} from ".";
import { Iterator } from "iterator-js";
import { parseTokens } from "./tokens";
import { DefaultVisitor, Tree, Visitor } from "../tree";
import { isEqual } from "../utils";
import { AbstractSyntaxTree } from "./ast";
import { ConsumeParsingResult, ParsingResult, TokenParser } from "./types";

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

export const parseString = (src: string, scope: Scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = { ...context.scope, ...scope };
  const result = parseExpr(context)(tokens).slice(1, 3);
  return result as ConsumeParsingResult<AbstractSyntaxTree>;
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [parsed] = parseString(templateStr);
  return template(parsed, values);
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  const [patternParsed] = parseString(pattern);
  return match(tree, patternParsed, matches);
};

export const matchTokens =
  (...tokens: string[]): TokenParser<boolean> =>
  (src, i = 0) => {
    const found = tokens.includes(src[i]?.src);
    console.log("matchTokens", tokens, i, src[i]?.src, found);

    if (found) return [i + 1, true, []];
    return [i, false, []];
  };

export const mapParsingResult = <T, const U>(
  [index, result, errors]: ParsingResult<T>,
  fn: (result: T) => U
): ParsingResult<U> => [index, fn(result), errors];

export const mapParserResult =
  <T, const U>(parser: TokenParser<T>, fn: (result: T) => U): TokenParser<U> =>
  (src, i) =>
    mapParsingResult(parser(src, i), fn);

export const matchSeparators =
  (...separators: string[][]) =>
  (context: ParsingContext) => {
    const index = context.groupNodes?.length ?? 0;
    console.log("separators", separators, index, separators[index]);

    const separator = separators[index] ?? [];
    const isLast = index === separators.length - 1;
    return mapParserResult(matchTokens(...separator), (matched) =>
      matched ? (isLast ? "done" : "match") : "noMatch"
    );
  };
