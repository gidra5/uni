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

First class environments. Add quote/eval and we have macros