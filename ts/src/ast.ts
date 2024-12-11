import { SystemError } from "./error.js";
import { isPosition, Position } from "./position.js";
import { Token } from "./parser/tokens.js";
import { nextId, setPos } from "./utils/index.js";

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

  ADD: "add",
  PLUS: "plus",
  SUB: "subtract",
  MINUS: "minus",
  DIV: "/",
  MULT: "*",
  MOD: "%",
  POW: "pow",
  PARALLEL: "parallel",
  SEND: "send",
  LABEL: ":",
  TUPLE: ",",
  NOT_EQUAL: "!=",
  EQUAL: "==",
  DEEP_EQUAL: "===",
  DEEP_NOT_EQUAL: "!==",
  AND: "and",
  OR: "or",
  LESS: "<",
  LESS_EQUAL: "<=",
  APPLICATION: "application",
  SEQUENCE: "sequence",
  SEND_STATUS: "?<-",
  GREATER: ">",
  GREATER_EQUAL: ">=",
  IS: "is",
  IN: "in",
  BIND: "@",
  PIN: "pin",

  RECEIVE: "receive",
  DECLARE: ":=",
  ASSIGN: "=",
  NOT: "not",
  PARENS: "parens",
  INDEX: "index",
  SQUARE_BRACKETS: "square_brackets",
  BLOCK: "block",
  FUNCTION: "func",
  IF: "if",
  IF_ELSE: "if_else",
  WHILE: "while",
  IMPORT: "import",
  POST_INCREMENT: "post_increment",
  POST_DECREMENT: "post_decrement",
  DECREMENT: "--",
  INCREMENT: "++",
  TRY: "?",
  EXPORT: "export",
  RECEIVE_STATUS: "<-?",
  INC_ASSIGN: "+=",
  LOOP: "loop",
  FOR: "for",
  ASYNC: "async",
  AWAIT: "await",
  MATCH: "match",
  MATCH_CASE: "match_case",
  INJECT: "inject",
  MASK: "mask",
  WITHOUT: "without",
  CODE_LABEL: "::",
  PIPE: "|>",

  SPREAD: "...",
  MUTABLE: "mut",

  SCRIPT: "script",
  MODULE: "module",

  RECORD: "object",
  LIKE: "like",
  STRICT: "strict",
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

type ScriptNode = {
  id: number;
  data: {};
  type: typeof NodeType.SCRIPT;
  children: ExpressionNode[];
};
type ModuleNode = {
  id: number;
  data: {};
  type: typeof NodeType.MODULE;
  children: DeclarationNode[];
};
type ErrorNode<T extends Tree = Tree> = {
  id: number;
  data: { cause: SystemError };
  type: typeof NodeType.ERROR;
  children: [T] | [];
};
type ImplicitPlaceholderNode = {
  id: number;
  data: {};
  type: typeof NodeType.IMPLICIT_PLACEHOLDER;
  children: [];
};
type PlaceholderNode = {
  id: number;
  data: {};
  type: typeof NodeType.PLACEHOLDER;
  children: [];
};
type NameNode = {
  id: number;
  data: { value: string | symbol };
  type: typeof NodeType.NAME;
  children: [];
};
type NumberNode = {
  id: number;
  data: { value: number };
  type: typeof NodeType.NUMBER;
  children: [];
};
type StringNode = {
  id: number;
  data: { value: string };
  type: typeof NodeType.STRING;
  children: [];
};
type AtomNode = {
  id: number;
  data: { name: string };
  type: typeof NodeType.ATOM;
  children: [];
};

type BlockNode = {
  id: number;
  data: {};
  type: typeof NodeType.BLOCK;
  children: [ExpressionNode];
};
type SequenceNode = {
  id: number;
  data: {};
  type: typeof NodeType.SEQUENCE;
  children: ExpressionNode[];
};
type TupleNode = {
  id: number;
  data: {};
  type: typeof NodeType.TUPLE;
  children: ExpressionNode[];
};
type FunctionNode = {
  id: number;
  data: { isTopFunction?: false };
  type: typeof NodeType.FUNCTION;
  children: [PatternNode, ExpressionNode];
};
type DeclarationNode = Tree;

type ExpressionNode =
  | Tree
  | ErrorNode
  | ImplicitPlaceholderNode
  | PlaceholderNode
  | NameNode
  | NumberNode
  | StringNode
  | AtomNode
  | BlockNode
  | SequenceNode
  | FunctionNode
  | TupleNode;

type PatternNode = Tree | PlaceholderNode | NameNode | StringNode | NumberNode | AtomNode;

enum Associativity {
  LEFT = "left",
  RIGHT = "right",
  LEFT_AND_RIGHT = "both",
}

enum Fixity {
  PREFIX = "prefix",
  POSTFIX = "postfix",
  INFIX = "infix",
  NONE = "none",
}

const generatePrecedences = <T extends string>(precedenceList: [T, Fixity, Associativity?][]) => {
  const precedences = {} as Record<T, Precedence>;

  // if two same operators are next to each other, which one will take precedence
  // left associative - left one will take precedence
  // right associative - right one will take precedence
  // associative - does not matter, can be grouped in any order
  const leftAssociative = (p: number): Precedence => [p, p + 1];
  const rightAssociative = (p: number): Precedence => [p + 1, p];
  const associative = (p: number): Precedence => [p, p];
  let precedenceCounter = 0;

  for (const [operator, fixity, associativity] of precedenceList) {
    precedenceCounter++;

    if (fixity === Fixity.PREFIX) {
      precedences[operator] = [null, precedenceCounter];
    } else if (fixity === Fixity.POSTFIX) {
      precedences[operator] = [precedenceCounter, null];
    } else if (fixity === Fixity.NONE) {
      precedences[operator] = [null, null];
    } else if (associativity === Associativity.LEFT_AND_RIGHT) {
      precedences[operator] = associative(precedenceCounter);
    } else if (associativity === Associativity.LEFT) {
      precedences[operator] = leftAssociative(precedenceCounter++);
    } else precedences[operator] = rightAssociative(precedenceCounter++);
  }

  return precedences;
};

// if two same operators are next to each other, which one will take precedence
// first come lower precedence operators
const exprPrecedenceList: [NodeType, Fixity, Associativity?][] = [
  [NodeType.SEQUENCE, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
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

  [NodeType.PARALLEL, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.PIPE, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.TUPLE, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.LABEL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.SPREAD, Fixity.PREFIX],

  [NodeType.SEND, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.RECEIVE, Fixity.PREFIX],
  [NodeType.SEND_STATUS, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.RECEIVE_STATUS, Fixity.PREFIX],

  [NodeType.OR, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.AND, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.NOT_EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.DEEP_EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.DEEP_NOT_EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.LESS, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.LESS_EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.GREATER, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.GREATER_EQUAL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.IS, Fixity.POSTFIX],
  [NodeType.IN, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.NOT, Fixity.PREFIX],

  [NodeType.ADD, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.SUB, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.MULT, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.DIV, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.MOD, Fixity.INFIX, Associativity.LEFT],
  [NodeType.POW, Fixity.INFIX, Associativity.RIGHT],
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
  [NodeType.APPLICATION, Fixity.INFIX, Associativity.LEFT],
  [NodeType.INDEX, Fixity.POSTFIX],
  [NodeType.TRY, Fixity.POSTFIX],
] as const;

const patternPrecedenceList: [NodeType, Fixity, Associativity?][] = [
  [NodeType.TUPLE, Fixity.INFIX, Associativity.LEFT_AND_RIGHT],
  [NodeType.LABEL, Fixity.INFIX, Associativity.RIGHT],
  [NodeType.SPREAD, Fixity.PREFIX],
  [NodeType.ASSIGN, Fixity.POSTFIX],
  [NodeType.MUTABLE, Fixity.PREFIX],
  [NodeType.LIKE, Fixity.PREFIX],
  [NodeType.STRICT, Fixity.PREFIX],
  [NodeType.EXPORT, Fixity.PREFIX],
  [NodeType.NOT, Fixity.PREFIX],
  [NodeType.INDEX, Fixity.POSTFIX],
  [NodeType.BIND, Fixity.INFIX, Associativity.RIGHT],
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

const node = (type: string, { data = {}, position, children = [] }: NodeOptions = {}): Tree => {
  const id = nextId();
  if (position) setPos(id, position);
  return { type, id, data, children };
};

export const error = <T extends Tree>(cause: SystemError, _node: T | Position): ErrorNode<T> =>
  node(NodeType.ERROR, {
    data: { cause },
    children: "type" in _node ? [_node] : [],
    position: isPosition(_node) ? _node : undefined,
  }) as ErrorNode<T>;

export const implicitPlaceholder = (position: Position): ImplicitPlaceholderNode =>
  node(NodeType.IMPLICIT_PLACEHOLDER, { position }) as ImplicitPlaceholderNode;

export const placeholder = (position: Position): PlaceholderNode =>
  node(NodeType.PLACEHOLDER, { position }) as PlaceholderNode;

export const name = (value: string | symbol, position: Position): NameNode =>
  node(NodeType.NAME, { data: { value }, position }) as NameNode;

export const number = (value: number, position: Position): NumberNode =>
  node(NodeType.NUMBER, { data: { value }, position }) as NumberNode;

export const string = (value: string, position: Position): StringNode =>
  node(NodeType.STRING, { data: { value }, position }) as StringNode;

export const token = (token: Token, position: Position) =>
  token.type === "number"
    ? number(token.value, position)
    : token.type === "string"
    ? string(token.value, position)
    : token.type === "placeholder"
    ? placeholder(position)
    : token.type === "error"
    ? error(token.cause, position)
    : name(token.src, position);

export const atom = (name: string, position?: Position): AtomNode =>
  node(NodeType.ATOM, { data: { name }, position }) as AtomNode;

export const module = (children: ModuleNode["children"]): ModuleNode =>
  node(NodeType.MODULE, { children }) as ModuleNode;

export const script = (children: ScriptNode["children"]): ScriptNode =>
  node(NodeType.SCRIPT, { children }) as ScriptNode;

export const block = (expr: ExpressionNode, position?: Position): BlockNode =>
  node(NodeType.BLOCK, { position, children: [expr] }) as BlockNode;

export const sequence = (children: Tree[]): SequenceNode => node(NodeType.SEQUENCE, { children }) as SequenceNode;

export const fn = (
  pattern: Tree,
  body: Tree,
  { position, isTopFunction = true }: { position?: Position; isTopFunction?: boolean } = {}
): FunctionNode => {
  const children = [pattern, body];
  const _node = node(NodeType.FUNCTION, { position, children }) as FunctionNode;
  if (!isTopFunction) _node.data.isTopFunction = isTopFunction;
  return _node;
};

export const tuple = (children: Tree[]): TupleNode => node(NodeType.TUPLE, { children }) as TupleNode;

export const loop = (body: Tree, position?: Position) => node(NodeType.LOOP, { children: [body], position });
export const ifElse = (condition: Tree, ifTrue: Tree, ifFalse: Tree, position?: Position) =>
  node(NodeType.IF_ELSE, { children: [condition, ifTrue, ifFalse], position });
export const application = (fn: Tree, arg: Tree) => node(NodeType.APPLICATION, { children: [fn, arg] });
