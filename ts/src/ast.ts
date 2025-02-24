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
  LABEL: ":",
  TUPLE: ",",
  TUPLE_SET: "tuple_set",
  TUPLE_PUSH: "tuple_push",
  TUPLE_JOIN: "tuple_join",
  NOT_EQUAL: "!=",
  EQUAL: "==",
  DEEP_EQUAL: "===",
  DEEP_NOT_EQUAL: "!==",
  AND: "and",
  OR: "or",
  LESS: "<",
  LESS_EQUAL: "<=",
  APPLICATION: "application",
  DELIMITED_APPLICATION: "delimited_application",
  SEQUENCE: "sequence",
  SEND_STATUS: "?<-",
  GREATER: ">",
  GREATER_EQUAL: ">=",
  IS: "is",
  AS: "as",
  COALESCE: ":>",
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
  UNEXPORT: "unexport",
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
  TEMPLATE: "template",
  TYPEOF: "typeof",
  TYPE: "type",

  REF: "ref",
  DEREF: "deref",

  SPREAD: "...",
  MUTABLE: "mut",
  CONST: "const",

  SCRIPT: "script",
  MODULE: "module",

  RECORD: "object",
  LIKE: "like",
  STRICT: "strict",
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
