
High-level structure:
```
computation = 
  | "(" computation ")"
  | application
  | placeholder 
  | block 
  | effect
  | structured
  | concurrency
  | logical
  | constructors
  | arithmetic
  | scope
```

utilities:
`colon_compute_or_block = ":" computation | block`
`block = "{" sequence "}"`
`sequence = computation (";" computation)*`

## Effect handlers

`effect = ("inject" | "without" | "mask") computation colon_compute_or_block | "use" (pattern | "." identifier)`

## structured expressions

```
structured = 
  | ("while" | "for" pattern "in" | "loop") computation colon_compute_or_block 
  | identifier "::" computation
  | "if" computation colon_compute_or_block ("else" computation)?
  | "switch" computation "{" (arrow_function ",")* arrow_function? ","? "}"
```

## concurrent expressions

```
concurrency = 
  | ("async" | "await" | "<-" | "<-?") computation
  | computation ("<-" | "?<-") computation
  | "|"? computation ("|" computation)*
```

## logical expressions

```
logical = 
  | computation ("and" | "or" | "==" | "===" | "!=" | "!==" | ">" | ">=" | "<" | "<=")
  | ("not" | "!") computation
```

## arithmetic expressions

```
arithmetic = 
  | ("+" | "-") computation
  | computation ("+" | "-" | "*" | "/" | "%" | "^") computation
```

## constructors and destructors

`bracketed = "[" computation "]"`
`pair = (bracketed | identifier) ":" computation`
`tuple_item = pair | computation | "..." computation`
`tuple = (tuple_item ",")+ tuple_item?`
`access = computation (bracketed | "." identifier) | bracketed`
`atom = ":" identifier`

```
constructors = 
  | tuple
  | access
  | atom
  | ("*" | "&") computation
```

## scope modifiers

```
scope =
 | decl_pattern ":=" expr
 | assign_pattern "=" expr
 | inc_pattern ("+=" | "-=") expr
 | expr_and_pattern ("++" | "--")
 | ("++" | "--") expr_and_pattern
```



