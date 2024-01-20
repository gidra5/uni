import { Iterator } from "iterator-js";
export type Tree = { name: string; children: Tree[] };
export type TreeVisitor<T, Node extends Tree> = (node: Node) => T;
export type TreeVisitors<T, Node extends Tree> = {
  [K in Node["name"]]: TreeVisitor<T, Extract<Node, { name: K }>>;
} & {
  [DefaultVisitor]: TreeVisitor<T, Node>;
};

export const DefaultVisitor = Symbol("DefaultVisitor");
export class Visitor<T, Node extends Tree = Tree> {
  constructor(private visitors: TreeVisitors<T, Node>) {}
  visitChildren(tree: Node): Iterator<T> {
    return Iterator.iter(tree.children).map(
      this.visitNode as TreeVisitor<T, Tree>
    );
  }
  visitNode(tree: Node): T {
    return (this.visitors[tree.name] ?? this.visitors[DefaultVisitor])(tree);
  }
}
