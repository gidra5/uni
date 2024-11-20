Given a functor or monad it is nice to be able to avoid explicit mapping and flattening of results, since they obscure the implementation.
For example:
```
x: Option<int>
y: Option<int>
x.map(x => y.map(y => x + y)).flat()
```
can be simplified to the inner most expression, if we assume the maps and flats are called implicitly on monads. Or if the value is not a monad, then just maps are implicit.

https://docs.idris-lang.org/en/latest/tutorial/interfaces.html#notation
https://www.reddit.com/r/ProgrammingLanguages/comments/okhg5x/languageassisted_flattening/