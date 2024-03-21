Continuation is a function that represents the rest of computation.

In lambda calculus it is an expression to which function application will return its result.
For example:
```
(a b) c
-----**
--- is a function application
*** is the rest of computation
```

if it is a first class entity, we could implement our own control flow like try-catch or break

```
stack := ()
block := fn label, body, continuation ->
  body = body with 
    break: fn val, label -> 
      (x := stack[label]; stack[label] = void; x[0]) val
    continue: fn label -> eval stack[label][1]
  stack[label] = (continuation, body)
  eval body
```