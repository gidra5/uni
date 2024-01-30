import { AbstractSyntaxTree } from "../parser/ast";
import { matchString } from "../parser/string";
import { mapField, setField } from "../utils";

const collectScope = (tree: AbstractSyntaxTree): string[] => {
  if (matchString(tree, "_ := _")[0]) {
    const { pattern } = matchString(tree, "pattern := _")[1];
  }

  return [];
};

export const resolve = <T>(
  tree: AbstractSyntaxTree<T>,
  scope: string[] = []
): AbstractSyntaxTree<T & { index?: number }> => {
  switch (tree.name) {
    case "name":
      return setField(["data", "index"], scope.indexOf(tree.value))(tree);
    case "group":
      return {
        name: "group",
        value: tree.value,
        children: tree.children.map(_resolve),
      };
    case "operator":
      return {
        name: "operator",
        value: tree.value,
        children: tree.children.map(_resolve),
      };
    default:
      return tree;
  }
};
