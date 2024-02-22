The language supports functional programming primitives such as functions.
`fn x, y -> body` - anonymous function
`x -> body` - arrow function
`f x` - function application
`f _ y` - argument placeholders
`fn -> #0 * 2` - referring to omitted names
`fn a -> fn a -> #a + a` - referring to shadowed names
`fn (a, b) -> a + b` - destructuring argument
`fn -> { return x; rest }` - return statement