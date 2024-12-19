
literal is:
* const
* macro (macro x -> y)
* either left (left x)
* either right (right x)

Term is:
* literal
* variable
* pair (x, y)
* call-by-value operator (<x\>)
* eval (eval x)
* apply (x y)

Rules:
* eval literal -> literal
* eval (x, y) -> (eval x) y
* eval <x\> -> <eval x\>
* (left x) () -> x
* (right x) (a, b) -> x a b
* (right x) a -> x a ()
* <x\> x1 ... xn -> x (eval x1) ... (eval xn)
* (macro x -> y) a -> y\[x=a]

Example:
```
eval ((fn x -> x * x) (2 + 3)) ->
<(right (macro x -> left (eval (x * x))))> (2 + 3) ->
(right (macro x -> left (eval (x * x)))) 5 ->
(macro x -> left (eval (x * x))) 5 () ->
(left (eval (5 * 5))) () ->
eval (5 * 5) ->
25 ->
```

Simplified


Example:
```
eval ((fn x -> x * x) (2 + 3)) ->
<macro x -> eval (x * x)> (2 + 3) ->
(macro x -> eval (x * x)) (eval (2 + 3)) ->
(macro x -> eval (x * x)) 5 ->
eval (5 * 5) ->
25 ->
```