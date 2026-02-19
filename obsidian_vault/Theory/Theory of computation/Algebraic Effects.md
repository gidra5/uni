An effect's operation is algebraic if it commutes with substitution.

If you substitute a term into a context, and then apply the effect operation,
you get the same result as applying the effect operation first, then substituting.

Formally:
`op(t[x := v])  =  (op t)[x := v]`

This means the operation:
* Does not inspect the structure of continuations
* Does not duplicate or discard continuations arbitrarily
* Behaves uniformly

This property ensures:
* Free models exist
* They admit handlers as homomorphisms

Following [this paper](https://www.sciencedirect.com/science/article/pii/S1571066115000705?ref=pdf_download&fr=RR-2&rr=8786637be9752498) One can describe algebraic effects and handlers with the syntax below:
```
value v ::= x     // variable
  | true | false  // boolean constants
  | fun x -> c    // function
  | h             // handler

handler h ::= handler {
  return x -> cr,                        // (optional) return clause
  op1(x; k) -> c1,..., op_n(x; k) -> c_n // operation clauses
}

computation c ::= return v    // return
  | op(v; y.c)                // operation call
  | do x <- c1 in c2          // sequencing
  | if v then c1 else c2      // conditional
  | v1 v2                     // application
  | with v handle c           // handling
```

We define operational semantics as a set of rewrite rules. The rules are made of two parts - preconditions and the reduction rule. 
The preconditions are written above `----` and the rule is written below. The `=>` symbol separates the initial term from the reduced one. The rules read as "if the term c1 reduces to c1', then the following reduction is applicable". If there are no preconditions, we omit the `----`. The `c[v/x]` notation means that the variable `x` is replaced by `v` in the term `c`.
The operational semantics of algebraic effects is defined as follows:
```
c1 => c1'
----
do x <- c1 in c2 => do x <- c1' in c2

c => c'
----
with h handle c => with h handle c' 

do x <- return v in c => c[v/x]
do x <- op(v; y. c1) in c2 => op(v; y. do x <- c1 in c2) 
if true then c1 else c2 => c1
if false then c1 else c2 => c2 
(fun x -> c) v => c[v/x]

with h handle (return v) => cr[v/x]
with h handle op_i(v; y.c) => c_i[v/x, (fun y -> with h handle c)/k] (op_i is in h)
with h handle op(v; y.c) => op(v; y. with h handle c) (op is not in h)
```

We can define an induction principle for some predicate `P` on computation `c`:
1. `P(return v)` holds for all `v`
2. `P(op(v; y.c'))` holds for all `v` and `op`, assuming `P(c')` holds for all `y`

We can also derive some equivalences for the terms based on the operational semantics:
```
do x <- return v in c === c[v/x]                                                          (1)
do x <- op(v; y. c1) in c2 === op(v; y. do x <- c1 in c2)                                 (2)
do x <- c in return x === c                                                               (3)
do x2 <- (do x1 <- c1 in c2) in c3 === do x1 <- c1 in (do x2 <- c2 in c3)                 (4)
if true then c1 else c2 === c1                                                            (5)
if false then c1 else c2 === c2                                                           (6)
if v then c[true/x] else c[false/x] === c[v/x]                                            (7)
(fun x -> c) v === c[v/x]                                                                 (8)
fun x -> v x === v                                                                        (9)
with h handle (return v) === cr[v/x]                                                      (10)
with h handle (op_i(v; y. c)) === c_i[v/x, (fun y -> with h handle c)/k] (op_i is in h)   (11)
with h handle (op(v; y. c)) === op(v; y. with h handle c) (op is not in h)                (12)
with (handler {return x -> c2}) handle c1 === do x <- c1 in c2                            (13)
```