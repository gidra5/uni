Using `->` for describing "statement form" is ambiguous together with using same symbol for lambda shorthand. But not actually a big problem, since it makes more sense to interpret `->` as part of statement form rather than lambda and use parens to unambiguously use lambdas there.


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
`statement_form = "do" computation | "->" sequence | block`
`block = "{" sequence "}"`
`sequence = computation (";" computation)*`

## Effect handlers

`effect = ("inject" | "without" | "mask") computation statement_form`

## structured expressions

```
structured = 
  | ("while" | "for" pattern "in" | "loop") computation statement_form 
  | identifier "::" computation
  | "if" computation statement_form 
  | "if" computation ("do" computation | block) "else" computation
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



