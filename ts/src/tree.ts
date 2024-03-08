export type Tree = { name: string; children: Tree[] };
export type TreeVisitor<Node extends { children: Node[] }> = (
  node: Node
) => [immediate: boolean, node?: Node] | Node | void;
export type Traverse = {
  <Node extends { children: Node[] }>(
    node: Node,
    matcher: (node: Node) => string | null,
    visitors: Record<string, TreeVisitor<Node>>,
    pre?: boolean
  ): Node;
  <Node extends { children: Node[] }>(
    node: Node,
    matcher: (node: Node) => boolean,
    visitors: TreeVisitor<Node>,
    pre?: boolean
  ): Node;
  <Node extends { name: string; children: Node[] }>(
    node: Node,
    name: string,
    visitors: TreeVisitor<Node>,
    pre?: boolean
  ): Node;
};

export const DefaultVisitor = Symbol("DefaultVisitor");

export const traverse: Traverse = (
  node: Tree,
  matcher: string | ((node: Tree) => boolean) | ((node: Tree) => string | null),
  visitors: TreeVisitor<Tree> | Record<string, TreeVisitor<Tree>>,
  pre: boolean = false
) => {
  if (pre) {
    for (let i = 0; i < node.children.length; i++) {
      // @ts-ignore
      node.children[i] = traverse(node.children[i], matcher, visitors);
    }
  }

  if (typeof matcher === "string") {
    matcher = (node) => node.name === matcher;
  }
  const matched = matcher(node);
  let visitor: TreeVisitor<Tree> | undefined;
  if (typeof matched === "string") {
    visitor = (visitors as Record<string, TreeVisitor<Tree>>)[matched] ?? visitors[DefaultVisitor];
  } else if (matched) {
    visitor = visitors as TreeVisitor<Tree>;
  }

  if (pre) {
    if (visitor) {
      const visited = visitor(node);
      if (visited) return visited;
    }
    return node;
  }

  let immediateReturn = false;
  if (visitor) {
    const visited = visitor(node);
    if (Array.isArray(visited)) {
      immediateReturn = visited[0];
      if (visited[1]) node = visited[1];
    } else if (visited) node = visited;
  }

  if (immediateReturn) return node;

  for (let i = 0; i < node.children.length; i++) {
    // @ts-ignore
    node.children[i] = traverse(node.children[i], matcher, visitors);
  }

  return node;
};
