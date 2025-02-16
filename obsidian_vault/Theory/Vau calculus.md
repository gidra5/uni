
https://web.cs.wpi.edu/~jshutt/jns-nepls07.txt
https://web.archive.org/web/20101011085011/http://www.wpi.edu/Pubs/ETD/Available/etd-090110-124904/unrestricted/jshutt.pdf

Simplified

literal is:
* const
* env `[x: y, ...]`
* macro `macro x -> y`
* capture `env -> x`
* pair `x y`
* left project `left`
* right project `right`

Term is:
* literal
* variable `x`
* eval `eval<e> x`
* bind `bind<e> x`
* apply `apply<e> x y`

Rules:
* `eval<e> literal => literal`
* `eval<[x: y, ...]> x => y`
* `eval<[x': y, ...e]> x => eval<e> x`
* `eval<e> (x y) => apply<e> (eval<e> x) y`
* `bind<e> literal => literal`
* `bind<e> (x y) => (bind<e> x) (bind<e> y)`
* `bind<e> (left y) => left (bind<e> y)`
* `bind<e> (right y) => right (bind<e> y)`
* `bind<e1> e2 => [...e1, ...e2]`
* `bind<e> (macro x -> y) => macro x -> bind<[x: x, ...e]> y`
* `bind<e> (env -> y) => env -> bind<[x: x, ...e]> y`
* `apply<e> (macro x -> y) a => bind<[x: a]> y`
* `apply<e> (env -> x) a => apply<e> (apply<[]> x e) a`
* `apply<e> left (x y) => x`
* `apply<e> right (x y) => y`

...

Example:
```
eval ((fn x -> x * x) (2 + 3)) ->
(macro y -> (macro x -> eval (x * x)) (eval y)) (2 + 3) ->
(macro x -> eval (x * x)) (eval (2 + 3)) ->
(macro x -> eval (x * x)) 5 ->
eval (5 * 5) ->
25
```

```
apply<[]> (macro x -> x 1) a ->
(x 1)<x: a> ->
x<x: a> 1<x: a> ->
a 1 ->
```