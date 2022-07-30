import { Result, Option, TaggedItemUnion, TaggedUnion } from "../types.mjs";
import { ParsingHandler } from "./utils.mjs";

export enum Error {
  UNEXPECTED_END,
  UNRECOGNIZED_INPUT,
  UNRECOGNIZED_OPERATOR,
  MISSING_CLOSING_APOSTROPHE,
  SKIP,
}
export const LITERAL_TYPES: Literal["type"][] = ["ident", "char", "multilineString", "number", "string", 'boolean'];
export const EXPRESSION_TYPES: ExpressionType["type"][] = ["infix", "mixfix", "postfix", "prefix", "record", 'type'];
export const KEYWORDS = ["for", "in", "if", "is", "as", "_", "fn"] as const;
export const MAX_PRECEDENCE = 256;

export class Record {
  constructor(private values: { name: Value, value: Value }[] = []) { }
  
  static fromArray(values: Value[]) {
    return new Record(values.map((value, index) => ({ value, name: { type: 'number', item: index}})))
  }
    
  append(value: Value, _name?: Value) {
    if (_name)
      this.values = this.values.filter(({ name }) => name === _name);
    this.values.push({ value, name: _name ?? { type: 'number', item: this.values.length} });
  }
  set(_value: Value, _name: Value) {
    this.values = this.values.map(({ name, value }) => ({ name, value: name === _name ? _value : value }) );
  }
}

export type Value = TaggedItemUnion<{
  string: string;
  char: string;
  number: number;
  boolean: boolean;
  record: Record;
  function: { env: Environment, registry: OperatorRegistry, body: Expression, pattern: Pattern };
}>;

export type Environment = { [x in string]: Value };

export type Type = TaggedUnion<{
  define: { pattern: Pattern },
  unknown: {},
  nominal: {},
  assignable: { assignableType: Type }
}>;

export type Span = { start: number; end: number };
export type FileSpan = Span & { index: number };
export type RegistryKey = string;
export class Registry<T> {
  constructor(private registry: { [k in RegistryKey]: T } = {}) {}

  entries() {
    return Object.entries(this.registry);
  }
  get(index: RegistryKey) {
    return this.registry[index];
  }
  register(item: T) {
    const key = crypto.randomUUID().slice(0, 8);
    this.registry[key] = item;
    return key;
  }
}

export type Literal = TaggedItemUnion<{
  ident: string;
  string: string;
  multilineString: string;
  char: string;
  number: number;
  boolean: 'true' | 'false'
}>;
export type Keyword = typeof KEYWORDS[number];
export type Token = Keyword | Literal | "\n" | "," | ":" | ";";
export type Precedence = [Option<number>, Option<number>];
export type OperatorSeparator = ({ ident: string | string[] } | { token: string | string[] }) & {
  optional?: boolean;
  repeat?: boolean;
};
export type OperatorDefinition = {
  separators: [
    OperatorSeparator & {
      ident: string | string[];
      optional?: never;
      repeat?: never;
    },
    ...OperatorSeparator[]
  ];
  precedence: Precedence;
  type: (...args: Operator[]) => Expression;
  evaluate: (env: Environment, registry: OperatorRegistry) => (...args: Expression[]) => Value;
  keepNewLine?: boolean;
};
export type OperatorRegistry = Registry<OperatorDefinition>;

export type OperatorType = {
  type: "operator";
  /**
   * for each non-leading separator, for each repetition of separator, collect all tokens and nested operators
   */
  operands: Operator[][][];
  /* id */ operator: RegistryKey;
};
export type Operator = OperatorType | Token;
export type ExpressionType = TaggedItemUnion<{
  prefix: { operator: Expression; right: Expression };
  postfix: { operator: Expression; left: Expression };
  infix: { operator: Expression; left: Expression; right: Expression };
  mixfix: { operator: RegistryKey; operands: Expression[][] };

  record: {
    key?: TaggedUnion<{
      name: { name: string };
      value: { value: Expression };
      rest: {};
    }>;
    value: Expression;
  }[];
  type: Type;
}>;
export type Expression = ExpressionType | Operator;
export type Pattern = TaggedItemUnion<{
  bind: string;
  value: Literal | Boolean | '_';
  record: {
    key?: TaggedUnion<{
      name: { name: string };
      value: { value: Pattern };
      rest: {};
    }>;
    value: Pattern;
  }[];
}> & { defaultValue?: Expression; alias?: string, valueType?: Type };

export type ModuleRegistry = Registry<ModuleItem[]>;
export type ModuleItem = TaggedItemUnion<{
  import: { module: number; pattern?: Pattern };
}> & { public?: boolean };
export type Script = [ModuleItem[], Expression[]];


export type Parser<T, U, E> = (state: ParsingHandler<T, U>) => Result<U, E>;
export type ParserRecovery<T, U, E> = (state: ParsingHandler<T, U>, error: E) => Error;


export const isOperator = (x?: Expression): x is OperatorType => !!x && typeof x === "object" && x.type === "operator";
export const isLiteral = (x?: Expression): x is Literal =>
  !!x && typeof x === "object" && LITERAL_TYPES.includes(x.type as Literal["type"]);
  export const isExpr = (x?: Expression): x is ExpressionType =>
    !!x && typeof x === "object" && EXPRESSION_TYPES.includes(x.type as ExpressionType["type"]);