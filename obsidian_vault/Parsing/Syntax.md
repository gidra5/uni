Syntax is defined by [[formal grammar]], which is defined using special symbols[^1], generally `->, *, +, ?, |`.

For a list of tokens refer to [[Tokenizer]]

### [[Modules|Module]]

```
module -> moduleItem*
moduleItem -> (import | external | definition) (newline | ";")?
import -> ("import") string ("as" pattern)? ("with" expression)?
external -> "external" pattern (":" type)? ("=" expression)?
definition -> "export"? pattern "=" expression
```

### Comments

```
comment -> "//" anything newline
blockComment -> "/*" (blockComment | anything_else) "*/"
```

### Pattern

```
pattern -> primitive | tuplePattern | recordPattern | binding
tuplePattern -> pattern ("," pattern)+
recordPattern -> labeledPattern ("," labeledPattern)+
labeledPattern -> (ident | "[" pattern "]"): pattern
binding -> ("_" | precedence? precedence? ident+) ("=" expression)?
precedence -> number | "none" | "inf"
```

### Value

```
value -> primitive | tuple | record | function | "(" expression ")" | "{" expression ((newline | ";") expression)? "}"
primitive -> string | number | identifier
tuple -> expression ("," expression)+
record -> labeled ("," labeled)+
labeled -> (ident | "[" expression "]"): expression
function -> pattern "->" expression
```

### Type

```
type -> primitive | "number" | "string" | "boolean" | taggedUnionType | unionType | tupleType | recordType | functionType
unionType -> type ("|" type)+
taggedUnionType -> labeledType ("|" labeledType)+
tupleType -> type ("," type)+
recordType -> labeled ("," labeled)+
labeledType -> (ident | "[" type "]"): type
functionType -> type "->" type
```

### Expression

Expressions are parsed with [[Pratt parser|pratt parser]] when all participating operators are identified. There are predefined operators such as:

1. `_ _ +: number -> number -> number` - sum of numbers
2. `_ _ -: number -> number -> number` - diff of numbers
3. `_ _ *: number -> number -> number` - mult of numbers
4. `_ _ /: number -> number -> number` - div of numbers
5. `_ _ +: string -> string -> string` - concat of strings
6. `_ _ |>: ('a -> 'b) -> ('b -> 'c) -> ('a -> 'c)` - piping functions
7. `none _ if then else?: bool -> (() -> 'a) -> (() -> 'b) -> 'a | 'b` - conditional
8. `_ _ -: number -> number -> number` - diff of numbers*
9. `_ _ -: number -> number -> number` - diff of numbers
10. `_ _ -: number -> number -> number` - diff of numbers
11. `_ _ -: number -> number -> number` - diff of numbers
12. `_ _ -: number -> number -> number` - diff of numbers
13. `_ _ -: number -> number -> number` - diff of numbers
14. `_ _ -: number -> number -> number` - diff of numbers

[^1]: https://craftinginterpreters.com/representing-code.html