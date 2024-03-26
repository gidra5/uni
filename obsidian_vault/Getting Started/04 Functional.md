The language supports functional programming primitives such as functions.
`fn x, y -> body` - anonymous function
`x -> body` - arrow function
`f x` - function application
`f _ y` - argument placeholders
`fn -> #0 * 2` - referring to omitted names
`fn a -> fn a -> #a + a` - referring to shadowed names
`fn (a, b) -> a + b` - destructuring argument
`fn -> { return x; rest }` - return statement

Any variables found in closure will be copied to a function's instance. So every instance will have its own copy of closed over variables, which means they can't modify them directly. To share state between closures references must be used.

Also supports functors and monads - operations on wrapped values are automatically lifted and flattened. 
For example:
```
x: option int
y: option int
1 + x => x.map (1 + _)
x + x => x.flatMap (_ + x) 
      => x.flatMap (fn _x -> x.map (_x + _))
fn -> x + y + 1 => fn -> x.flatMap fn x -> y.map fn y -> x + y + 1
```

The rules are:
1. If operation requires value of type `T`, and it is given value `functor T` - wrap application into `map` of a given functor
2. If operation reqires two values of types `T` and `U`, and it is given values `monad T` and `monad U` - wrap operation into `flatmap map` of a given monad

The rules accomplish work of type casting (converting value to a target type in an expression) in context of boxed values
For this to work properly wrappers should obey monad and functor laws.
Functor laws:
1. `x.map id = id`
2. `(x.map f).map g = x.map (_  |> f |> g)`

Monad laws:
1. `(wrap a).flatmap f = f a`
2. `x.flatmap wrap = x`
3. `(x.flatmap f).flatmap g = x.flatmap ((f _).flatmap g)`

Considering monads are functors as well, we may formulate monad laws differently:
1. `((wrap a).map f).flat = f a`
2. `(x.map wrap).flat = x`
3. `(x.map f).flat.map g = x.map (((f _).map g).flat)`