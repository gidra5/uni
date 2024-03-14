import { TokenParserWithContext } from "./index.js";
import { Iterator } from "iterator-js";
import { DefaultVisitor, Tree, traverse } from "../tree.js";
import { isEqual, omit } from "../utils/index.js";
import { AbstractSyntaxTree } from "./ast.js";
import { ParsingResult, Precedence, TokenParser } from "./types.js";

export type TemplateValues =
  | AbstractSyntaxTree[]
  | Record<string, AbstractSyntaxTree>
  | (AbstractSyntaxTree[] & Record<string, AbstractSyntaxTree>);
export const template = (tree: AbstractSyntaxTree, _values: TemplateValues) => {
  const values = _values as AbstractSyntaxTree[];
  return traverse(tree, (node) => node.name, {
    placeholder: (tree) => {
      return [true, values.shift() ?? tree];
    },
    name: (tree) => {
      return [true, values[tree.value as string] ?? tree];
    },
  });
};

type MatchTree = { name: string; value?: any; children: MatchTree[] };
type MatchTree2<T> = { name: string; value?: any; children: T[] };
export const match = <T extends MatchTree2<T>>(
  tree: T,
  pattern: MatchTree,
  matches: T[] & Record<string, T> = [] as unknown as T[] & Record<string, T>
): [boolean, T[] & Record<string, T>] => {
  // console.dir({ msg: "match", tree, pattern, matches }, { depth: null });

  const result: [boolean, T[] & Record<string, T>] = [true, matches];

  traverse<any>({ ...pattern, tree }, (node) => node.name, {
    [DefaultVisitor]: ({ ...pattern }) => {
      const tree = pattern.tree;
      // console.log({ msg: "DefaultVisitor", tree, pattern, matches }, { depth: null });

      if (tree.name !== pattern.name) result[0] = false;
      if (tree.value !== pattern.value) result[0] = false;
      if (tree.children.length !== pattern.children.length) result[0] = false;
      if (!result[0]) return { ...pattern, children: [] };

      for (const [[child, _tree], i] of Iterator.iter<any>(pattern.children).zip(tree.children).enumerate()) {
        pattern.children[i] = { ...child, tree: _tree };
      }

      return pattern;
    },
    placeholder: (pattern) => {
      result[1].push(pattern.tree);
    },
    name: (pattern) => {
      pattern = omit(pattern, ["data"]);
      // console.dir({ msg: "name", pattern, matches }, { depth: null });
      const name = pattern.value as string;
      if (name in matches) {
        result[0] = isEqual(pattern.tree, matches[name]);
        return;
      }
      result[1][name] = pattern.tree;
    },
  });

  return result;
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

// if two same operators are next to each other, which one will take precedence
// left associative - left one will take precedence
// right associative - right one will take precedence
// associative - does not matter, can be grouped in any order
export const leftAssociative = (precedence: number): Precedence => [precedence, precedence + 1];
export const rightAssociative = (precedence: number): Precedence => [precedence + 1, precedence];
export const associative = (precedence: number): Precedence => [precedence, precedence];
