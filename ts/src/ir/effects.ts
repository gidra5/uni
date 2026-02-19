import { NodeType, type Tree } from "../ast.js";

type IrBase = {
  id: number;
  data: Tree["data"];
};

export type EffectIrGenericNode = IrBase & {
  kind: "generic";
  sourceType: string;
  children: EffectIrNode[];
};

export type EffectIrWithNode = IrBase & {
  kind: "with";
  handlers: EffectIrNode;
  body: EffectIrNode;
};

export type EffectIrMaskNode = IrBase & {
  kind: "mask";
  effect: EffectIrNode;
  body: EffectIrNode;
};

export type EffectIrWithoutNode = IrBase & {
  kind: "without";
  effect: EffectIrNode;
  body: EffectIrNode;
};

export type EffectIrPerformNode = IrBase & {
  kind: "perform";
  effect: EffectIrNode;
  arg: EffectIrNode;
};

export type EffectIrPerformerNode = IrBase & {
  kind: "performer";
  effect: EffectIrNode;
};

export type EffectIrNode =
  | EffectIrGenericNode
  | EffectIrWithNode
  | EffectIrMaskNode
  | EffectIrWithoutNode
  | EffectIrPerformNode
  | EffectIrPerformerNode;

export type EffectIrProgram = {
  root: EffectIrNode;
};

const unwrapParens = (node: Tree): Tree => {
  if (node.type !== NodeType.PARENS || !node.children[0]) return node;
  return unwrapParens(node.children[0]);
};

const flattenApplication = (node: Tree): { callee: Tree; args: Tree[] } => {
  const [callee, ...args] = node.children;
  if (!callee) return { callee: node, args: [] };

  const unwrappedCallee = unwrapParens(callee);
  if (unwrappedCallee.type === NodeType.APPLICATION || unwrappedCallee.type === NodeType.DELIMITED_APPLICATION) {
    const inner = flattenApplication(unwrappedCallee);
    return { callee: inner.callee, args: [...inner.args, ...args] };
  }

  return { callee: unwrappedCallee, args };
};

const lowerNode = (node: Tree): EffectIrNode => {
  if (node.type === NodeType.INJECT) {
    const [handlers, body] = node.children;
    if (handlers && body) {
      return {
        kind: "with",
        id: node.id,
        data: node.data,
        handlers: lowerNode(handlers),
        body: lowerNode(body),
      };
    }
  }

  if (node.type === NodeType.MASK) {
    const [effect, body] = node.children;
    if (effect && body) {
      return {
        kind: "mask",
        id: node.id,
        data: node.data,
        effect: lowerNode(effect),
        body: lowerNode(body),
      };
    }
  }

  if (node.type === NodeType.WITHOUT) {
    const [effect, body] = node.children;
    if (effect && body) {
      return {
        kind: "without",
        id: node.id,
        data: node.data,
        effect: lowerNode(effect),
        body: lowerNode(body),
      };
    }
  }

  if (node.type === NodeType.APPLICATION || node.type === NodeType.DELIMITED_APPLICATION) {
    const { callee, args } = flattenApplication(node);
    if (callee.type === NodeType.NAME && callee.data.value === "handle") {
      if (args.length === 1) {
        return {
          kind: "performer",
          id: node.id,
          data: node.data,
          effect: lowerNode(args[0]),
        };
      }
      if (args.length === 2) {
        return {
          kind: "perform",
          id: node.id,
          data: node.data,
          effect: lowerNode(args[0]),
          arg: lowerNode(args[1]),
        };
      }
    }
  }

  return {
    kind: "generic",
    id: node.id,
    data: node.data,
    sourceType: node.type,
    children: node.children.map(lowerNode),
  };
};

const handleNameNode = (id: number): Tree => ({
  type: NodeType.NAME,
  id,
  data: { value: "handle" },
  children: [],
});

const liftNode = (node: EffectIrNode): Tree => {
  switch (node.kind) {
    case "with":
      return {
        type: NodeType.INJECT,
        id: node.id,
        data: node.data,
        children: [liftNode(node.handlers), liftNode(node.body)],
      };
    case "mask":
      return {
        type: NodeType.MASK,
        id: node.id,
        data: node.data,
        children: [liftNode(node.effect), liftNode(node.body)],
      };
    case "without":
      return {
        type: NodeType.WITHOUT,
        id: node.id,
        data: node.data,
        children: [liftNode(node.effect), liftNode(node.body)],
      };
    case "perform":
      return {
        type: NodeType.APPLICATION,
        id: node.id,
        data: node.data,
        children: [handleNameNode(node.id), liftNode(node.effect), liftNode(node.arg)],
      };
    case "performer":
      return {
        type: NodeType.APPLICATION,
        id: node.id,
        data: node.data,
        children: [handleNameNode(node.id), liftNode(node.effect)],
      };
    case "generic":
      return {
        type: node.sourceType,
        id: node.id,
        data: node.data,
        children: node.children.map(liftNode),
      };
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
};

export const lowerAstToEffectIr = (ast: Tree): EffectIrProgram => ({
  root: lowerNode(ast),
});

export const liftEffectIrToAst = (program: EffectIrProgram): Tree => liftNode(program.root);
