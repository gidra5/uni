
https://web.cs.wpi.edu/~jshutt/jns-nepls07.txt
https://web.archive.org/web/20101011085011/http://www.wpi.edu/Pubs/ETD/Available/etd-090110-124904/unrestricted/jshutt.pdf

Simplified

literal is:
* const
* env `[x: y, ...]`
* macro `macro x -> y`
* capture `env e -> x`
* pair `x y`
* left project `left x`
* right project `right x`

Term is:
* literal
* variable `x`
* eval `eval x e`
* apply `x y e`
* lookup `e[x]`

Rules:
* `eval literal e -> literal`
* `eval x [x: y] -> e[x]`
* `eval (x y) e -> (eval x e) y e`
* `(macro x -> y) a e -> y<x: a>`
* `(env e -> x) a e -> (x e []) a e`
* 

Example:
```
eval ((fn x -> x * x) (2 + 3)) ->
(macro x -> eval (x * x)) (eval (2 + 3)) ->
(macro x -> eval (x * x)) 5 ->
eval (5 * 5) ->
25
```