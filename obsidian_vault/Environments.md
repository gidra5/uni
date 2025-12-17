https://pauillac.inria.fr/~herbelin/articles/hor-Her06-duality.pdf?utm_source=chatgpt.com
https://homepages.inf.ed.ac.uk/wadler/papers/dual/dual.pdf?utm_source=chatgpt.com
http://arxiv.org/pdf/1006.2283

We can model evaluation environment explicitly as follows:
```
expr = x | fn x -> expr | expr expr
env = [] | expr.env
command = <expr|env>
```

the environment can be interpreted as a stack of values, or as a stack of continuations to be executed later.

First class environments. Add quote/eval and we have macros