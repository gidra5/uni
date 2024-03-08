Supports imperative mutations.
`x := expr` - declare variable
`x = expr` - mutate variable
`x.y = expr` - mutate field of a variable
`x["y"] = expr` - mutate dynamic field of a variable
`x, y = expr` - multiple assignment by destructuring

Left hand side of mutation or declaration must be a destructuring pattern. 
Patterns assign or declare *names*, which represent *bound* memory location that holds some value.
Fields count as bound location only if they access some other bound location.
It is important to note, that assignments require names to be already declared.
Which basically means, names can be either variable names or fields.
