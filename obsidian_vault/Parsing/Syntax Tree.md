After [[Token Tree]] is generated, we can breadth first parse it into actual syntax tree.

First are parsed all declarations in a module, then interpret declarations to add custom operators to be used inside declaration bodies.

Same strategy applied recursively after one layer is fully processed.

While parsing expressions some nodes may declare new variables. For example
* `1+2 is x and x > 1` -> `((1+2) is x) and (x > 1)` -> `(1+2) is x` declared `x` for the rest of expression and returned `boolean`, that will short-circuit when used with `and`
* `if 1+2 is x: x+1 else 2` -> `if ((1+2) is x): (x+1) else 2` -> condition declared `x` for the `then` branch only
* `{ x = 1; 2 + x }` -> `x = 1` declared `x` for the rest of the block, `=` declared by block itself
* `for x, y of z: x + y` -> `x, y` declared `x` and `y` for the body of `for` loop
* `while 1+2 is x: x+1` -> `1+2 is x` declared `x` for the body of `while` loop
* `(1+2 is x and x+1) or (3-4 is y and y+2)` - `x` declared only for `x+1`
* `(1+2 is x or 3+4 is x) and x-1` - `x` declared for `x-1`
* `1+2 is x and x+1 is x and x-1` - `1+2 is x` declared `x`, `x+1 is x` redeclared `x` using previous declaration, and used in `x-1`
* `x is of_type number and x+1` - `x is of_type number` declares type of `x` as `number` for the rest of expression and returned `boolean`, that will short-circuit when used with `and`
* `async { await x }` - `await` declared by `async` in `{ await x }`
* `async { x = () -> { /* no await*/ }; await x }` - `await` declared by `async` in the lexical scope, but undeclared in `() -> { /* no await*/ }`
* `x, y -> x + y` - declares `x`, `y` for the body of the function

`or` declares intersection of declarations in its operands for the rest of expression
`and` declares union of declarations in its operands for the rest of expression