
first "vau-x-calculus"

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
* <x\> x1 ... xn -> x (eval x1) ... (eval xn)
* (macro x -> y) a -> y\[x=a]