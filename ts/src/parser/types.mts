// import {
//   Result,
//   Option,
//   TaggedItemUnion,
//   TaggedUnion,
//   none,
//   some,
// } from "../types.js";
// import { Registry, RegistryKey } from "../utils.js";
// import { ParsingHandler } from "./utils.js";

// export enum Error {
//   UNEXPECTED_END,
//   UNRECOGNIZED_INPUT,
//   UNRECOGNIZED_OPERATOR,
//   MISSING_CLOSING_APOSTROPHE,
//   SKIP,
// }
// export const LITERAL_TYPES: Literal["type"][] = [
//   "ident",
//   // "char",
//   // "multilineString",
//   "number",
//   // "string",
//   // "boolean",
// ];
// export const EXPRESSION_TYPES: ExpressionType["type"][] = [
//   "infix",
//   "mixfix",
//   "postfix",
//   "prefix",
//   "record",
// ];
// export const KEYWORDS = ["_"] as const;
// export const MAX_PRECEDENCE = 256;

// export type Span = { start: number; end: number };
// export type FileSpan = Span & { index: number };

// export type Literal = TaggedItemUnion<{
//   ident: string;
//   // string: string;
//   // multilineString: string;
//   // char: string;
//   number: number;
//   // boolean: "true" | "false";
// }>;
// export type Keyword = (typeof KEYWORDS)[number];
// export type Token = Keyword | Literal | "\n" | "," | ":" | ";";
// export type Precedence = [Option<number>, Option<number>];
// export type OperatorSeparator<T = Token> = {
//   token: T | T[];
//   optional?: boolean;
//   repeat?: boolean;
// };
// export type OperatorDefinition = {
//   separators: OperatorSeparator[];
//   precedence?: Precedence;
//   keepNewLine?: boolean;
// };
// export type OperatorRegistry = Registry<OperatorDefinition>;

// export type OperatorType = {
//   type: "operator";
//   /**
//    * for each non-leading separator, for each repetition of separator, collect all tokens and nested operators
//    */
//   operands: Operator[][][];
//   item: RegistryKey;
// };
// export type Operator = OperatorType | Token;
// export type ExpressionType = TaggedItemUnion<{
//   prefix: { operator: Expression; right: Expression };
//   postfix: { operator: Expression; left: Expression };
//   infix: { operator: Expression; left: Expression; right: Expression };
//   mixfix: { operator: RegistryKey; operands: Expression[][] };

//   record: TaggedItemUnion<{
//     list: {
//       rest?: boolean;
//       value: Expression;
//     }[];
//     map: {
//       key?: TaggedUnion<{
//         name: { item: string };
//         value: { item: Expression };
//         rest: {};
//       }>;
//       value: Expression;
//     }[];
//   }>;

//   block: { program: Program };
// }>;
// export type Expression = ExpressionType | Operator;
// export type Pattern = TaggedItemUnion<{
//   bind: string;
//   value: Literal | Boolean | "_";
//   record: TaggedItemUnion<{
//     list: {
//       rest?: boolean;
//       value: Pattern;
//     }[];
//     map: {
//       key?: TaggedUnion<{
//         name: { item: string };
//         value: { item: Pattern };
//         rest: {};
//       }>;
//       value: Pattern;
//     }[];
//   }>;
// }> & { defaultValue?: Expression; alias?: string };

// export type ModuleItem = TaggedItemUnion<{
//   import: { module: RegistryKey; pattern?: Pattern };
//   value: { expr: Expression; pattern?: Pattern };
//   external: { pattern: Pattern };
// }> & { public?: boolean };
// export type Program = TaggedItemUnion<{
//   script: Expression[];
//   module: ModuleItem[];
// }>;

// export const isOperator = (x?: Expression): x is OperatorType =>
//   !!x && typeof x === "object" && x.type === "operator";
// export const isLiteral = (x?: Expression): x is Literal =>
//   !!x &&
//   typeof x === "object" &&
//   LITERAL_TYPES.includes(x.type as Literal["type"]);
// export const isIdentifier = (
//   x?: Expression
// ): x is Literal & { type: "ident" } =>
//   !!x && typeof x === "object" && x.type === "ident";
// export const isExpr = (x?: Expression): x is ExpressionType =>
//   !!x &&
//   typeof x === "object" &&
//   EXPRESSION_TYPES.includes(x.type as ExpressionType["type"]);

// export const operand = (): Precedence => [none(), none()];
// export const postfix = (precedence = MAX_PRECEDENCE): Precedence => [
//   some(precedence),
//   none(),
// ];
// export const prefix = (precedence = MAX_PRECEDENCE): Precedence => [
//   none(),
//   some(precedence),
// ];
// export const infixRight = (
//   rightPrecedence = MAX_PRECEDENCE,
//   leftPrecedence = rightPrecedence - 1
// ): Precedence => [some(leftPrecedence), some(rightPrecedence)];
// export const infixLeft = (
//   leftPrecedence = MAX_PRECEDENCE,
//   rightPrecedence = leftPrecedence - 1
// ): Precedence => [some(leftPrecedence), some(rightPrecedence)];
// export const infixRightWeak = (
//   rightPrecedence = MAX_PRECEDENCE,
//   leftPrecedence = 0
// ): Precedence => [some(leftPrecedence), some(rightPrecedence)];
// export const infixLeftWeak = (
//   leftPrecedence = MAX_PRECEDENCE,
//   rightPrecedence = 0
// ): Precedence => [some(leftPrecedence), some(rightPrecedence)];
