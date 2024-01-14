import { endOfTokensError, error } from "../errors";
import Iterator from "../iterator";
import { parseTokens } from "../tokens";
import { DefaultVisitor, Tree, Visitor } from "../tree";
import { isEqual } from "../utils";
import { ParsingError, TokenParser, TokenPos } from "./types";

export type Precedence = [prefix: number | null, postfix: number | null];
const getPrecedence = (node: AbstractSyntaxTree, scope: Scope): Precedence =>
  (node.value && scope[node.value].precedence) || [null, null];

export type TokenGroupDefinition = {
  separators: string[];
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;

const splitScope = (scope: Scope) => {
  const [postfix, prefix] = Iterator.iterEntries(scope).partition(
    ([_, { precedence }]) => precedence[0] !== null
  );
  return [postfix.toObject(), prefix.toObject()];
};

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

const placeholder = (): AbstractSyntaxTree => ({
  name: "placeholder",
  children: [],
});
const name = (value: string): AbstractSyntaxTree => ({
  name: "name",
  value,
  children: [],
});

export const parseGroup =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    const errors: ParsingError[] = [];
    const matchingScope = Iterator.iterEntries(context.scope).filter(
      ([_, { separators }]) => src[i].src === separators[0]
    );

    if (matchingScope.isEmpty()) {
      errors.push(error("Unexpected token", (src[i] as TokenPos).pos));
      return [i, name(src[i].src), errors];
    }

    return [i, placeholder(), errors];
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
      const [nextIndex, rhs, _errors] = parseExpr(context)(src, index);
      index = nextIndex;
      errors.push(..._errors);
      return [index, { name: "prefix", children: [group, rhs] }, errors];
    }

    return [index, group, errors];
  };

export const parseExpr =
  (context: ParsingContext): TokenParser<AbstractSyntaxTree> =>
  (src, i = 0) => {
    let index = i;
    const errors: ParsingError[] = [];
    let [nextIndex, lhs, _errors] = parsePrefix(context)(src, index);
    index = nextIndex;
    errors.push(..._errors);

    while (src[index]) {
      //skip possible whitespace prefix
      if (src[index].type === "newline") {
        index++;
        continue;
      }
      let [nextIndex, token, _errors] = parseGroup(context)(src, index);
      errors.push(..._errors);
      const [left, right] = getPrecedence(token, context.scope);
      if (left === null || left < context.precedence) break;
      index = nextIndex;
      if (right === null) {
        lhs = { name: "postfix", children: [token, lhs] };
      } else {
        const [nextIndex, rhs, _errors] = parseExpr(context)(src, index);
        index = nextIndex;
        errors.push(..._errors);
        lhs = { name: "infix", children: [token, lhs, rhs] };
      }
    }

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
