export type ScopeGenerator = (enclosing: Scope) => Scope;
export type SeparatorDefinition = {
  tokens: string[];
  repeats: [min: number, max: number];
  insertIfMissing?: boolean;
  scope?: ScopeGenerator;

  /** synchronized*/
  parse?: (
    src: TokenGroupSeparatorChild[],
    i: number,
    scope: Scope
  ) => ParsingResult<TokenGroupSeparatorChild>;
};
export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: SeparatorDefinition[];
  leadingTokens: string[];
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;

export type Token =
  | { type: "identifier" | "newline"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string; value: string };
export type TokenGroup = { token: Token; children: TokenGroupSeparator[] };
export type TokenGroupInstance = { id: string; type: "operator" } & TokenGroup;
export type TokenGroupSeparatorChild = TokenGroupInstance | Token;
export type TokenGroupSeparator = {
  children: TokenGroupSeparatorChild[];
  separatorIndex: number;
  separatorToken: Token;
};
export type FlatSyntaxTree = {
  item: TokenGroupSeparatorChild;
  lhs?: FlatSyntaxTree;
  rhs?: FlatSyntaxTree;
};
export type AbstractSyntaxTreeChildren = {
  children: AbstractSyntaxTree[];
  separatorIndex: number;
  separatorToken: Token;
};
export type AbstractSyntaxTreeItem =
  | Token
  | {
      id: string;
      type: "operator";
      token: Token;
      children: AbstractSyntaxTreeChildren[];
    };
export type AbstractSyntaxTree = {
  item: AbstractSyntaxTreeItem;
  lhs?: AbstractSyntaxTree;
  rhs?: AbstractSyntaxTree;
};

export type ParsingError = { message: string; cause?: ParsingError[] };
export type ConsumeParsingResult<T> = [result: T, errors: ParsingError[]];
export type ParsingResult<T> = [
  index: number,
  ...result: ConsumeParsingResult<T>
];
export type Parser<T, S = string> = (src: S, i: number) => ParsingResult<T>;
