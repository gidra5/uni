export type Tree = { name: string; children: Tree[] };
export type TreeVisitor<T, Node extends Tree> = (node: Node) => T;
export type TreeVisitors<T, Node extends Tree> = {
  [K in Node["name"]]: TreeVisitor<T, Extract<Node, { name: K }>>;
} & {
  [DefaultVisitor]: TreeVisitor<T, Node>;
};

export const DefaultVisitor = Symbol("DefaultVisitor");
export const visit =
  <T, Node extends Tree>(visitors: TreeVisitors<T, Node>) =>
  (tree: Node): T =>
    (visitors[tree.name] ?? visitors[DefaultVisitor])(tree);
