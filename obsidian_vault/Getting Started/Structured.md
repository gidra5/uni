The language supports structural programming primitives such as blocks of code, loops, if statements.
`if x { expr }`
`if x: expr`
`if x { expr } else expr`
`if x { expr } else { expr }`
`if x: expr else { expr }`
`if x: expr else expr` - if statement
`while x: expr`
`while x { expr }` - while loop
`for x in y: expr`
`for x in y { expr }` - for loop
`loop: expr`
`loop { expr }` - generic loop
`loop { continue expr; rest }`
`loop { continue; rest }` - loop continue statement
`loop { break expr; rest }`
`loop { break; rest }` - loop break statement
`x; y` - sequences
`{ x; y }` - blocks
`{ break; rest }` - block break statement
`{ break expr; rest }` - block break statement
`label: while x { ... }` - statement labels
