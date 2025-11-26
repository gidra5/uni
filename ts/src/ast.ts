import fc, { type Arbitrary } from "fast-check";
import { SystemError } from "./error.js";
import { isPosition, Position } from "./utils/position.js";
import { nextId, setPos } from "./utils/index.js";
import type { TokenGroup } from "./parser/tokenGroups.js";

export type Tree = {
  type: string;
  id: number;
  data: any;
  children: Tree[];
};
export type Precedence = [prefix: number | null, postfix: number | null];

export const NodeType = {
  ERROR: "error",

  IMPLICIT_PLACEHOLDER: "implicit_placeholder",
  PLACEHOLDER: "placeholder",
  NAME: "name",
  NUMBER: "number",
  STRING: "string",
  ATOM: "atom",
  HASH_NAME: "hash_name",
  UNIT: "unit",

  ADD: "add",
  PLUS: "plus",
  SUB: "subtract",
  MINUS: "minus",
  DIV: "/",
  MULT: "*",
  MOD: "%",
  POW: "pow",

  PARALLEL: "parallel",
  SUPERPOSITION: "superposition",
  SEND: "send",
  SEND_STATUS: "?<-",
  RECEIVE: "receive",
  RECEIVE_STATUS: "<-?",
  ASYNC: "async",
  AWAIT: "await",

  LABEL: ":",
  TUPLE: ",",
  TUPLE_SET: "tuple_set",
  TUPLE_PUSH: "tuple_push",
  TUPLE_JOIN: "tuple_join",
  SPREAD: "...",

  NOT_EQUAL: "!=",
  EQUAL: "==",
  DEEP_EQUAL: "===",
  DEEP_NOT_EQUAL: "!==",
  AND: "and",
  OR: "or",
  NOT: "not",
  LESS: "<",
  LESS_EQUAL: "<=",
  GREATER: ">",
  GREATER_EQUAL: ">=",
  IS: "is",
  IN: "in",

  DECLARE: ":=",
  ASSIGN: "=",
  INC_ASSIGN: "+=",
  IF: "if",
  IF_ELSE: "if_else",
  WHILE: "while",
  LOOP: "loop",
  FOR: "for",
  SEQUENCE: "sequence",
  BLOCK: "block",
  MATCH: "match",
  MATCH_CASE: "match_case",
  POST_INCREMENT: "post_increment",
  POST_DECREMENT: "post_decrement",
  DECREMENT: "--",
  INCREMENT: "++",
  TRY: "?",

  FUNCTION: "func",
  APPLICATION: "application",
  DELIMITED_APPLICATION: "delimited_application",
  PIPE: "|>",

  AS: "as",
  COALESCE: ":>",
  BIND: "@",
  PIN: "pin",
  MUTABLE: "mut",
  CONST: "const",
  CODE_LABEL: "::",
  RECORD: "object",
  LIKE: "like",
  STRICT: "strict",

  PARENS: "parens",
  INDEX: "index",
  SQUARE_BRACKETS: "square_brackets",

  IMPORT: "import",
  EXPORT: "export",
  UNEXPORT: "unexport",

  INJECT: "inject",
  MASK: "mask",
  WITHOUT: "without",

  TEMPLATE: "template",
  TYPEOF: "typeof",
  TYPE: "type",

  REF: "ref",
  DEREF: "deref",

  SCRIPT: "script",
  MODULE: "module",
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

enum Fixity {
  PREFIX = "prefix",
  POSTFIX = "postfix",
  INFIX_LEFT = "infix_left",
  INFIX_RIGHT = "infix_right",
  INFIX = "infix",
  NONE = "none",
}

const generatePrecedences = <T extends string>(precedenceList: [T, Fixity][]) => {
  const precedences = {} as Record<T, Precedence>;

  // if two same operators are next to each other, which one will take precedence
  // left associative - left one will take precedence
  // right associative - right one will take precedence
  // associative - does not matter, can be grouped in any order
  const leftAssociative = (p: number): Precedence => [p, p + 1];
  const rightAssociative = (p: number): Precedence => [p + 1, p];
  const associative = (p: number): Precedence => [p, p];
  let precedenceCounter = 0;

  for (const [operator, fixity] of precedenceList) {
    precedenceCounter++;

    if (fixity === Fixity.PREFIX) {
      precedences[operator] = [null, precedenceCounter];
    } else if (fixity === Fixity.POSTFIX) {
      precedences[operator] = [precedenceCounter, null];
    } else if (fixity === Fixity.NONE) {
      precedences[operator] = [null, null];
    } else if (fixity === Fixity.INFIX) {
      precedences[operator] = associative(precedenceCounter);
    } else if (fixity === Fixity.INFIX_LEFT) {
      precedences[operator] = leftAssociative(precedenceCounter++);
    } else precedences[operator] = rightAssociative(precedenceCounter++);
  }

  return precedences;
};

// if two same operators are next to each other, which one will take precedence
// first come lower precedence operators
const exprPrecedenceList: [NodeType, Fixity][] = [
  [NodeType.SEQUENCE, Fixity.INFIX],
  [NodeType.FUNCTION, Fixity.PREFIX],
  [NodeType.ASYNC, Fixity.PREFIX],
  [NodeType.IF, Fixity.PREFIX],
  [NodeType.IF_ELSE, Fixity.PREFIX],
  [NodeType.LOOP, Fixity.PREFIX],
  [NodeType.WHILE, Fixity.PREFIX],
  [NodeType.FOR, Fixity.PREFIX],
  [NodeType.INJECT, Fixity.PREFIX],
  [NodeType.MASK, Fixity.PREFIX],
  [NodeType.WITHOUT, Fixity.PREFIX],

  [NodeType.DECLARE, Fixity.PREFIX],
  [NodeType.ASSIGN, Fixity.PREFIX],
  [NodeType.INC_ASSIGN, Fixity.PREFIX],

  [NodeType.PARALLEL, Fixity.INFIX],
  [NodeType.SUPERPOSITION, Fixity.INFIX],
  [NodeType.PIPE, Fixity.INFIX],
  [NodeType.TUPLE, Fixity.INFIX],
  [NodeType.LABEL, Fixity.INFIX_RIGHT],
  [NodeType.SPREAD, Fixity.PREFIX],

  [NodeType.SEND, Fixity.INFIX_RIGHT],
  [NodeType.RECEIVE, Fixity.PREFIX],
  [NodeType.SEND_STATUS, Fixity.INFIX_RIGHT],
  [NodeType.RECEIVE_STATUS, Fixity.PREFIX],

  [NodeType.OR, Fixity.INFIX],
  [NodeType.AND, Fixity.INFIX],
  [NodeType.EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.NOT_EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.DEEP_EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.DEEP_NOT_EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.LESS, Fixity.INFIX_RIGHT],
  [NodeType.LESS_EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.GREATER, Fixity.INFIX_RIGHT],
  [NodeType.GREATER_EQUAL, Fixity.INFIX_RIGHT],
  [NodeType.IS, Fixity.POSTFIX],
  [NodeType.IN, Fixity.INFIX],
  [NodeType.NOT, Fixity.PREFIX],
  [NodeType.DEREF, Fixity.PREFIX],

  [NodeType.ADD, Fixity.INFIX],
  [NodeType.SUB, Fixity.INFIX],
  [NodeType.MULT, Fixity.INFIX],
  [NodeType.DIV, Fixity.INFIX],
  [NodeType.MOD, Fixity.INFIX_LEFT],
  [NodeType.POW, Fixity.INFIX_RIGHT],
  [NodeType.MINUS, Fixity.PREFIX],
  [NodeType.PLUS, Fixity.PREFIX],
  [NodeType.INCREMENT, Fixity.PREFIX],
  [NodeType.DECREMENT, Fixity.PREFIX],
  [NodeType.CODE_LABEL, Fixity.PREFIX],
  [NodeType.POST_INCREMENT, Fixity.POSTFIX],
  [NodeType.POST_DECREMENT, Fixity.POSTFIX],

  [NodeType.IMPORT, Fixity.PREFIX],
  [NodeType.EXPORT, Fixity.PREFIX],
  [NodeType.MUTABLE, Fixity.PREFIX],
  [NodeType.AWAIT, Fixity.PREFIX],
  [NodeType.TYPEOF, Fixity.PREFIX],
  [NodeType.AS, Fixity.INFIX],
  [NodeType.COALESCE, Fixity.INFIX],
  [NodeType.APPLICATION, Fixity.INFIX_LEFT],
  [NodeType.INDEX, Fixity.POSTFIX],
  [NodeType.DELIMITED_APPLICATION, Fixity.POSTFIX],
  [NodeType.TRY, Fixity.POSTFIX],
] as const;

const patternPrecedenceList: [NodeType, Fixity][] = [
  [NodeType.TUPLE, Fixity.INFIX],
  [NodeType.LABEL, Fixity.INFIX_RIGHT],
  [NodeType.SPREAD, Fixity.PREFIX],
  [NodeType.ASSIGN, Fixity.POSTFIX],
  [NodeType.MUTABLE, Fixity.PREFIX],
  [NodeType.CONST, Fixity.PREFIX],
  [NodeType.LIKE, Fixity.PREFIX],
  [NodeType.STRICT, Fixity.PREFIX],
  [NodeType.EXPORT, Fixity.PREFIX],
  [NodeType.UNEXPORT, Fixity.PREFIX],
  [NodeType.OR, Fixity.INFIX],
  [NodeType.AND, Fixity.INFIX],
  [NodeType.NOT, Fixity.PREFIX],
  [NodeType.TYPE, Fixity.PREFIX],
  [NodeType.APPLICATION, Fixity.INFIX_LEFT],
  [NodeType.INDEX, Fixity.POSTFIX],
  [NodeType.BIND, Fixity.INFIX_RIGHT],
  [NodeType.ATOM, Fixity.PREFIX],
] as const;

const exprPrecedences = generatePrecedences(exprPrecedenceList);

const patternPrecedences = generatePrecedences(patternPrecedenceList);

export const getExprPrecedence = (operator: string): Precedence => {
  return exprPrecedences[operator] ?? [null, null];
};

export const getPatternPrecedence = (operator: string): Precedence => {
  return patternPrecedences[operator] ?? [null, null];
};

type NodeOptions = {
  data?: any;
  position?: Position;
  children?: Tree[];
};

export const node = (type: string, { data = {}, position, children = [] }: NodeOptions = {}): Tree => {
  const id = nextId();
  if (position) setPos(id, position);
  return { type, id, data, children };
};

export const error = <T extends Tree>(cause: SystemError, _node: T | Position): Tree =>
  node(NodeType.ERROR, {
    data: { cause },
    children: "type" in _node ? [_node] : [],
    position: isPosition(_node) ? _node : undefined,
  });

export const implicitPlaceholder = (position: Position) => node(NodeType.IMPLICIT_PLACEHOLDER, { position });

export const placeholder = (position: Position) => node(NodeType.PLACEHOLDER, { position });

export const name = (value: string | symbol, position: Position) => node(NodeType.NAME, { data: { value }, position });

export const number = (value: number, position: Position) => node(NodeType.NUMBER, { data: { value }, position });

export const string = (value: string, position: Position) => node(NodeType.STRING, { data: { value }, position });

export const token = (token: TokenGroup, position: Position) =>
  token.type === "number"
    ? number(token.value, position)
    : token.type === "string"
    ? string(token.value, position)
    : token.type === "placeholder"
    ? placeholder(position)
    : token.type === "error"
    ? error(token.cause, position)
    : token.type === "identifier"
    ? name(token.name, position)
    : error(SystemError.unknown(), position);

export const atom = (name: string, position?: Position) => node(NodeType.ATOM, { data: { name }, position });

export const module = (children: Tree[]) => node(NodeType.MODULE, { children });

export const script = (children: Tree[]) => node(NodeType.SCRIPT, { children });

export const block = (expr: Tree, position?: Position) => node(NodeType.BLOCK, { position, children: [expr] });

export const sequence = (children: Tree[]) => node(NodeType.SEQUENCE, { children });

export const fn = (
  pattern: Tree,
  body: Tree,
  { position, isTopFunction = true }: { position?: Position; isTopFunction?: boolean } = {}
) => {
  const children = [pattern, body];
  const _node = node(NodeType.FUNCTION, { position, children });
  if (!isTopFunction) _node.data.isTopFunction = isTopFunction;
  return _node;
};

export const tuple = (children: Tree[]) => node(NodeType.TUPLE, { children });

export const loop = (body: Tree, position?: Position) => node(NodeType.LOOP, { children: [body], position });
export const ifElse = (condition: Tree, ifTrue: Tree, ifFalse: Tree, position?: Position) =>
  node(NodeType.IF_ELSE, { children: [condition, ifTrue, ifFalse], position });
export const application = (fn: Tree, arg: Tree) => node(NodeType.APPLICATION, { children: [fn, arg] });

// TODO: ai generated. review
export type TreeArbitraryOptions = { maxDepth?: number; withPositions?: boolean };

export const treeArbitrary = ({ maxDepth = 4, withPositions = false }: TreeArbitraryOptions = {}): Arbitrary<Tree> => {
  const positionArb: Arbitrary<Position | undefined> = withPositions
    ? fc
        .tuple(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }))
        .map(([start, end]) => ({ start: Math.min(start, end), end: Math.max(start, end) }))
    : fc.constant(undefined);
  const applyPos = (position?: Position) => (withPositions ? position : undefined);

  const identifierArb = fc
    .string({ unit: "binary-ascii", minLength: 1, maxLength: 8 })
    .filter((value) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value));

  const nameArb = fc
    .tuple(identifierArb, positionArb)
    .map(([value, position]) => node(NodeType.NAME, { data: { value }, position: applyPos(position) }));
  const placeholderArb = positionArb.map((position) => node(NodeType.PLACEHOLDER, { position: applyPos(position) }));
  const implicitPlaceholderArb = positionArb.map((position) =>
    node(NodeType.IMPLICIT_PLACEHOLDER, { position: applyPos(position) })
  );
  const numberLiteralArb = fc
    .tuple(fc.double({ noNaN: true, noDefaultInfinity: true }), positionArb)
    .map(([value, position]) => node(NodeType.NUMBER, { data: { value }, position: applyPos(position) }));
  const stringLiteralArb = fc
    .tuple(fc.string({ unit: "binary-ascii", minLength: 1, maxLength: 24 }), positionArb)
    .map(([value, position]) => node(NodeType.STRING, { data: { value }, position: applyPos(position) }));
  const atomArb = fc
    .tuple(identifierArb, positionArb)
    .map(([name, position]) => node(NodeType.ATOM, { data: { name }, position: applyPos(position) }));

  const leafArb = fc.oneof(
    nameArb,
    numberLiteralArb,
    stringLiteralArb,
    atomArb,
    placeholderArb,
    implicitPlaceholderArb
  );

  const binaryChainTypes = [
    NodeType.ADD,
    NodeType.SUB,
    NodeType.MULT,
    NodeType.DIV,
    NodeType.MOD,
    NodeType.LESS,
    NodeType.POW,
    NodeType.EQUAL,
    NodeType.DEEP_EQUAL,
    NodeType.GREATER,
    NodeType.AND,
    NodeType.OR,
    NodeType.IN,
  ] as const;

  const unaryTypes = [NodeType.PARENS, NodeType.DEREF, NodeType.PLUS, NodeType.MINUS, NodeType.NOT] as const;

  const { tree } = fc.letrec<{
    tree: Tree;
    pattern: Tree;
    functionPattern: Tree;
  }>((tie) => {
    const patternBase = fc.oneof(
      nameArb,
      numberLiteralArb,
      stringLiteralArb,
      atomArb,
      placeholderArb,
      implicitPlaceholderArb
    );
    const pattern = fc.oneof(
      { maxDepth, depthIdentifier: "pattern" },
      patternBase,
      fc
        .tuple(positionArb, tie("pattern"))
        .map(([position, child]) => node(NodeType.NOT, { children: [child], position: applyPos(position) }))
    );

    const functionPattern = fc.oneof(
      { maxDepth, depthIdentifier: "functionPattern" },
      fc.oneof(nameArb, placeholderArb, implicitPlaceholderArb),
      fc
        .tuple(positionArb, fc.array(tie("functionPattern"), { maxLength: 3 }))
        .map(([position, children]) => node(NodeType.TUPLE, { children, position: applyPos(position) }))
    );

    const squareBracketsArb = fc
      .tuple(positionArb, tie("tree"))
      .map(([position, child]) => node(NodeType.SQUARE_BRACKETS, { children: [child], position: applyPos(position) }));

    const labelKeyArb = fc.oneof(nameArb, atomArb, squareBracketsArb);

    const labelEntryArb = fc
      .tuple(positionArb, labelKeyArb, tie("tree"))
      .map(([position, key, value]) => node(NodeType.LABEL, { children: [key, value], position: applyPos(position) }));

    const tupleArb = fc
      .tuple(positionArb, fc.array(fc.oneof(tie("tree"), labelEntryArb), { maxLength: 3 }))
      .map(([position, children]) => node(NodeType.TUPLE, { children, position: applyPos(position) }));

    const recordArb = fc
      .tuple(positionArb, fc.array(labelEntryArb, { maxLength: 3 }))
      .map(([position, children]) => node(NodeType.RECORD, { children, position: applyPos(position) }));

    const templateArb = fc
      .tuple(positionArb, fc.array(fc.oneof(stringLiteralArb, tie("tree")), { minLength: 1, maxLength: 3 }))
      .map(([position, children]) => node(NodeType.TEMPLATE, { children, position: applyPos(position) }));

    const binaryChainArb = fc
      .tuple(fc.constantFrom(...binaryChainTypes), positionArb, fc.array(tie("tree"), { minLength: 2, maxLength: 4 }))
      .map(([type, position, children]) => node(type, { children, position: applyPos(position) }));

    const unaryArb = fc
      .tuple(fc.constantFrom(...unaryTypes), positionArb, tie("tree"))
      .map(([type, position, child]) => node(type, { children: [child], position: applyPos(position) }));

    const incrementArb = fc
      .tuple(fc.constantFrom(NodeType.INCREMENT, NodeType.POST_INCREMENT), positionArb, nameArb)
      .map(([type, position, target]) => node(type, { children: [target], position: applyPos(position) }));

    const applicationArb = fc
      .tuple(
        fc.constantFrom(NodeType.APPLICATION, NodeType.DELIMITED_APPLICATION),
        positionArb,
        fc.array(tie("tree"), { minLength: 2, maxLength: 3 })
      )
      .map(([type, position, children]) => node(type, { children, position: applyPos(position) }));

    const pipeArb = fc
      .tuple(positionArb, fc.array(tie("tree"), { minLength: 2, maxLength: 4 }))
      .map(([position, children]) => node(NodeType.PIPE, { children, position: applyPos(position) }));

    const blockArb = fc
      .tuple(positionArb, tie("tree"))
      .map(([position, child]) => node(NodeType.BLOCK, { children: [child], position: applyPos(position) }));

    const sequenceArb = fc
      .tuple(positionArb, fc.array(tie("tree"), { minLength: 1, maxLength: 4 }))
      .map(([position, children]) => node(NodeType.SEQUENCE, { children, position: applyPos(position) }));

    const scriptArb = fc
      .tuple(positionArb, fc.array(tie("tree"), { maxLength: 4 }))
      .map(([position, children]) => node(NodeType.SCRIPT, { children, position: applyPos(position) }));

    const ifArb = fc
      .tuple(positionArb, tie("tree"), tie("tree"))
      .map(([position, condition, thenBranch]) =>
        node(NodeType.IF, { children: [condition, thenBranch], position: applyPos(position) })
      );

    const ifElseArb = fc
      .tuple(positionArb, tie("tree"), tie("tree"), tie("tree"))
      .map(([position, condition, thenBranch, elseBranch]) =>
        node(NodeType.IF_ELSE, { children: [condition, thenBranch, elseBranch], position: applyPos(position) })
      );

    const whileArb = fc
      .tuple(positionArb, tie("tree"), tie("tree"))
      .map(([position, condition, body]) =>
        node(NodeType.WHILE, { children: [condition, body], position: applyPos(position) })
      );

    const loopArb = fc
      .tuple(positionArb, tie("tree"))
      .map(([position, body]) => node(NodeType.LOOP, { children: [body], position: applyPos(position) }));

    const codeLabelArb = fc
      .tuple(positionArb, identifierArb, tie("tree"))
      .map(([position, name, body]) =>
        node(NodeType.CODE_LABEL, { data: { name }, children: [body], position: applyPos(position) })
      );

    const isArb = fc
      .tuple(positionArb, tie("tree"), tie("pattern"))
      .map(([position, valueNode, matchPattern]) =>
        node(NodeType.IS, { children: [valueNode, matchPattern], position: applyPos(position) })
      );

    const functionArb = fc
      .tuple(positionArb, tie("functionPattern"), tie("tree"))
      .map(([position, patternNode, body]) => fn(patternNode, body, { position, isTopFunction: true }));

    const assignmentArb = fc
      .tuple(positionArb, nameArb, tie("tree"))
      .map(([position, patternNode, value]) =>
        node(NodeType.ASSIGN, { children: [patternNode, value], position: applyPos(position) })
      );

    const declareArb = fc
      .tuple(positionArb, nameArb, tie("tree"))
      .map(([position, patternNode, value]) =>
        node(NodeType.DECLARE, { children: [patternNode, value], position: applyPos(position) })
      );

    const forArb = fc
      .tuple(positionArb, nameArb, tie("tree"), tie("tree"))
      .map(([position, patternNode, iterable, body]) =>
        node(NodeType.FOR, { children: [patternNode, iterable, body], position: applyPos(position) })
      );

    const tree = fc.oneof(
      { maxDepth, depthIdentifier: "tree" },
      leafArb,
      unaryArb,
      binaryChainArb,
      incrementArb,
      pipeArb,
      applicationArb,
      tupleArb,
      recordArb,
      blockArb,
      sequenceArb,
      scriptArb,
      templateArb,
      ifArb,
      ifElseArb,
      whileArb,
      loopArb,
      codeLabelArb,
      isArb,
      functionArb,
      assignmentArb,
      declareArb,
      forArb
    );

    return { tree, pattern, functionPattern };
  });

  return tree;
};
