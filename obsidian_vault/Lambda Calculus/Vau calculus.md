
https://web.cs.wpi.edu/~jshutt/jns-nepls07.txt
https://web.archive.org/web/20101011085011/http://www.wpi.edu/Pubs/ETD/Available/etd-090110-124904/unrestricted/jshutt.pdf

Simplified

literal is:
* const
* env `[x <- y, ...]`
* macro `macro x -> y`
* capture `env e -> x`

Term is:
* literal
* variable `x`
* eval `eval x e`
* apply `x y e`

Rules:
* eval literal -> literal
* eval (x y) -> (eval x) y
* eval eval x -> eval x
* (macro x -> y) a -> y\[x=a]

Example:
```
eval ((fn x -> x * x) (2 + 3)) ->
(macro x -> eval (x * x)) (eval (2 + 3)) ->
(macro x -> eval (x * x)) 5 ->
eval (5 * 5) ->
25
```