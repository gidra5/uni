export type ScopeGenerator = (enclosing: Scope) => Scope;
export type SeparatorDefinition = {
  tokens: string[];
  repeats: [min: number, max: number];
  scope?: ScopeGenerator;
};
export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: SeparatorDefinition[];
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;

export type Token =
  | { type: "identifier" | "whitespace" | "newline"; src: string }
  | { type: "number"; src: string; value?: number }
  | { type: "string"; src: string; value?: string };
export type TokenGroup = { token: Token; children: TokenGroupSeparator[] };
export type TokenGroupSeparatorChildren = (({ id: string; type: "operator" } & TokenGroup) | Token)[];
export type TokenGroupSeparator = {
  children: TokenGroupSeparatorChildren;
  separatorIndex: number;
  separatorToken: Token;
};
export type FlatSyntaxTree = { item: TokenGroupSeparatorChildren[number]; lhs?: FlatSyntaxTree; rhs?: FlatSyntaxTree };
export type AbstractSyntaxTreeChildren = {
  children: AbstractSyntaxTree[];
  separatorIndex: number;
  separatorToken: Token;
};
export type AbstractSyntaxTreeItem =
  | Token
  | { id: string; type: "operator"; token: Token; children: AbstractSyntaxTreeChildren[] };
export type AbstractSyntaxTree = {
  item: AbstractSyntaxTreeItem;
  lhs?: AbstractSyntaxTree;
  rhs?: AbstractSyntaxTree;
};

export type ParsingError = { message: string };
export type ConsumeParsingResult<T> = [result: T, errors: ParsingError[]];
export type ParsingResult<T> = [index: number, ...result: ConsumeParsingResult<T>];
export type Parser<T> = (src: string, i: number) => ParsingResult<T>;
