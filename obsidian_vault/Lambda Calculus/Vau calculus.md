
https://web.cs.wpi.edu/~jshutt/jns-nepls07.txt
https://web.archive.org/web/20101011085011/http://www.wpi.edu/Pubs/ETD/Available/etd-090110-124904/unrestricted/jshutt.pdf

Simplified

literal is:
* const
* env `[x: y, ...]`
* macro `macro x -> y`
* capture `env e -> x`
* pair `x y`
* left project `left`
* right project `right`

Term is:
* literal
* variable `x`
* eval `eval<e> x`
* apply `apply<e> x y`

Rules:
* `eval<e> literal -> literal`
* `eval<[x: y]> x -> y`
* `eval<e> (x y) -> apply<e> (eval<e> x) y`
* `apply<e> (macro x -> y) a -> y<x: a>`
* `apply<e>(env e -> x) a -> apply<e> (x e []) a`
* `apply<e> left (x y) -> x`
* `apply<e> right (x y) -> y`

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
eval ((fn x -> x * x) (2 + 3)) ->
(macro y -> (macro x -> eval (x * x)) (eval y)) (2 + 3) [] ->
(macro x -> eval (x * x)) (eval (2 + 3)) [] ->
(macro x -> eval (x * x)) 5 [] ->
eval (5 * 5) ->
25
```