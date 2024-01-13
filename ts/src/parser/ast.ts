import Iterator from "../iterator";
import { DefaultVisitor, Tree, Visitor } from "../tree";
import { isEqual } from "../utils";

export type AbstractSyntaxTree = Tree & { value?: string };

export const template = (
  tree: AbstractSyntaxTree,
  values: AbstractSyntaxTree[] | Record<string, AbstractSyntaxTree>
) => {
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
