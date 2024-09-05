
`(expr)` parens
`placeholder` a zero-size "void" value

## Effect handlers

`inject expr { sequence }` - inject value of `expr` as effect handler for the `sequence`
`inject expr: expr2` - inject value of `expr` as effect handler for the `expr2`
`use pattern` - declare `pattern` effects to be used in current scope
`use name` - take symbol `name` effect from env and return its handler
`without expr { sequence }` - hide all effect handlers named by symbols from `expr` list for the `sequence`
`without expr: expr2` - hide all effect handlers named by symbols from `expr` list for the `expr2`
`mask expr { sequence }` - hide closest effect handlers named by symbols from `expr` list for the `sequence`
`mask expr: expr2` - hide closest effect handlers named by symbols from `expr` list for the `expr2`

## Structured programming

`while expr: expr2`
`while expr { sequence }`
`for pattern in expr: expr2`
`for pattern in expr { sequence }`
`loop { expr }`
`if expr: expr`
`if expr { sequence }`
`if expr: expr else expr`
`if expr { sequence } else expr`
`switch expr { pattern -> expr, }`
`{ sequence }`
`label::expr`

## concurrency

`async expr`
`expr | expr`
`| expr\n|expr`
`<- expr`
`<-? expr`
`expr <- expr`
`expr ?<- expr`
`await expr`

## logic

`expr and expr`
`expr or expr`
`not expr`
`!expr`
`expr == expr`
`expr === expr`
`expr != expr`
`expr !== expr`
`expr > expr`
`expr >= expr`
`expr < expr`
`expr <= expr`

## data

`expr, expr`
`name: expr,`
`[expr]: expr,`
`expr.name`
`expr[expr]`
`expr, ...expr`
`:name`
`[expr]`
`*expr`
`&expr`

## arithmetic

`+expr`
`-expr`
`expr + expr`
`expr - expr`
`expr * expr`
`expr / expr`
`expr % expr`
`expr ^ expr`

## scope

`pattern := expr`
`pattern = expr`
`pattern += expr`
`pattern -= expr`
`expr_and_pattern++`
`expr_and_pattern--`
`--expr_and_pattern`
`++expr_and_pattern`




