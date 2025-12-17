https://pauillac.inria.fr/~herbelin/articles/hor-Her06-duality.pdf?utm_source=chatgpt.com
https://homepages.inf.ed.ac.uk/wadler/papers/dual/dual.pdf?utm_source=chatgpt.com
http://arxiv.org/pdf/1006.2283

We can model evaluation environment explicitly as follows:
```
expr = x | fn x -> expr | expr expr
env = [] | expr.env
command = <expr|env>

<x y|env> -> <x|y.env>
<fn x -> y|z.env> -> <y[x/z]|env>
```

the environment can be interpreted as a stack of values, or as a stack of continuations to be executed later (how?).

We can add "capturing" action operationally as follows:
```
expr = ... | capture.expr | captured(env)
env = ... | captured(env)

<capture.expr|env> -> <expr|captured(env).[]>
<captured(env)|x.env'> -> <x|env> (<x|env.env'>?)
```

We can write down `capture.expr` more explicitly as follows:
```
capture.expr = capture e.<expr|captured(e).[]>

<capture e.command|env> -> command[e/env]
```

With that in mind we can express `captured(env)` as well:
```
captured(env) = fn x -> capture a.<x|env> (fn x -> capture a.<x|env.a>?)
```

We can also elaborate application in terms of `capture a.cmd`:
```
x y = capture a.<x|y.a>
```

Together all of this gives us the following system:
```
expr = x | fn x -> expr | capture a.command
env = a | expr.env (| []?)
command = <expr|env>

<capture e.command|env> -> command[e/env]
<fn x -> y|z.env> -> <y[x/z]|env>
```

All of the above described call-by-name lambda calculus in a more explicit manner.
We can derive similar calculus for call-by-value system. 
First lets define call-by-value lambda calculus:
```
value = x | fn x -> expr
expr = value | expr expr
env = [] | expr:env | value.env
command = <expr|env>

<x y|env> -> <y|x:env>
<value|x:env> -> <x|value.env>
<fn x -> y|value.env> -> <y[x/value]|env>
```

Notice how it forces arguments to be reduced to values before actual application to the function. To-be-called function is now also appended to the environment until we get a value for the call.

We can eliminate `expr:env` construct by introducing explicit binder for the second reduction rule:
```
expr:env = bind v.<expr|v.env>

<value|bind v.command> -> command[v/value]
```

With this we can express call-by-value application as follows:
```
x y = capture a.<y|bind v.<x|v.a>>
```

Overall we get this system:
```
value = x | fn x -> expr
expr = value | capture a.command
env = a | [] | expr.env | bind v.command
command = <expr|env>

<value|bind v.command> -> command[v/value]
<capture e.command|env> -> command[e/env]
<fn x -> y|z.env> -> <y[x/z]|env>
```