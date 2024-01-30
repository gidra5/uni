import { TokenParserWithContext } from ".";
import { Iterator } from "iterator-js";
import { DefaultVisitor, Tree, Visitor } from "../tree";
import { isEqual } from "../utils";
import { AbstractSyntaxTree } from "./ast";
import { ParsingResult, TokenParser } from "./types";

export type TemplateValues = AbstractSyntaxTree[] | Record<string, AbstractSyntaxTree>;
export const template = (tree: AbstractSyntaxTree, values: TemplateValues) => {
  const visitor: Visitor<Tree, AbstractSyntaxTree> = new Visitor<Tree, AbstractSyntaxTree>({
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
): [boolean, Record<string, AbstractSyntaxTree>] => {
  type ReturnType = [boolean, Record<string, AbstractSyntaxTree>];
  // console.dir({ msg: "match", tree, pattern, matches }, { depth: null });

  const visitor: Visitor<ReturnType, AbstractSyntaxTree> = new Visitor({
    [DefaultVisitor]: (pattern) => {
      if (tree.name !== pattern.name) return [false, matches];
      if (tree.value !== pattern.value) return [false, matches];
      if (tree.children.length !== pattern.children.length) return [false, matches];
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

export const matchTokens =
  (...tokens: string[]): TokenParser<boolean> =>
  (src, i = 0) => {
    const found = tokens.some((x) => src[i]?.src === x || (x === "\n" && src[i]?.type === "newline"));
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
  (...separators: string[][]): TokenParserWithContext<"done" | "match" | "noMatch"> =>
  (context) => {
    const index = context.groupNodes?.length ?? 0;
    const separator = separators[index] ?? [];
    const isLast = index === separators.length - 1;
    const parser = mapParserResult(matchTokens(...separator), (matched) =>
      matched ? (isLast ? "done" : "match") : "noMatch"
    );
    return (src, i) => {
      const result = parser(src, i);
      if (separator.length === 0) return result;
      // console.log("matchSeparators", index, separator, isLast, JSON.stringify(src[i]?.src), i, result);
      return result;
    };
  };

const parseOperands =
  (...parsers: TokenParserWithContext<AbstractSyntaxTree>[]): TokenParserWithContext<AbstractSyntaxTree> =>
  (context) => {
    const index = context.groupNodes?.length ?? 0;
    return parsers[index - 1](context);
  };
