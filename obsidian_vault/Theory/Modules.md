Modules are a set of definitions.
Definitions can be:
1. type definitions
2. method on type definitions
3. modality definitions
4. trait definitions?
5. trait implementation on type
6. annotation definition
7. extension - add unprivileged methods in unrelated modules
8. state machines
9. dataflow circuits?
10. actors
11. databases?
12. selectors?

program migration and versioning
## Dataflow
https://en.wikipedia.org/wiki/Synchronous_programming_language
We define dataflow as a graph that transforms incoming signals into outgoing ones.

These are inherently passive - they only execute once some values are pushed through incoming signals. This also means they are lazy - downstream computation may even not execute.
Transformations can be cached if the inputs are the same as previous.

Graphs describe derived computations. We can connect them to the effects, which will re run every time inputs change.

The whole thing can be nested in effects as well. They will persist until the parent effect reruns. 

Once triggered, it will run until some fixpoint is reached, meaning no further update steps will change the state. If it is acyclic, it will reach this state almost immediately, otherwise it will run emitting new outputs until it settles down.

The whole thing is probably turing complete. It can natively support loops (cyclic graphs), sequencing, history (access to the previous values of signals) and conditionals through inner implementation of nodes (only fires one of the outputs). Another way to put it, is that all electronics is based on this model of computation.

## Datalog
https://en.wikipedia.org/wiki/Datalog
Datalog is a system for "storing" facts and judgements on them. These can be reinterpreted as database table rows and materialized views

materialized views and indexes allow to move cost from read queries to mutation queries. Without them it is practically costs nothing to insert/update/delete, but once we add views and indexes, we need to maintain them reactively and update periodically, or even on every query. But with that we optimize the reads by preparing everything beforehand and keeping it up to date

We can define database/logic like scope, where we state initial facts and judgements.

Following the logic interpretation, our judgements are derived from initial facts with logical operators and inductive variables:
```
edge(1, 2)
edge(2, 3)

reachable(x,y) = edge(x,y) or (edge(x,z) and reachable(z,y))
```

We can query this "database" with a query like this:
```
select (x, y) from reachable(x,y) where x = 1
```

Following database interpretation, we can allow rows to be general datatypes, allowed in the language. Making materialized views also have rows that are general datatypes:
```
edge(1, "hey", fn x -> x + 1)
edge(2, "yea", fn x -> x - 1)

reachable record { x, y } = ???
```

Usual prolog or datalog is equivalent to first-order logic, but we can extend it to higher order:
```
for x. for y. edge(x, y)
exists y. node(y)
```

We could constraint "for":
```
for x. for y. edge(x, y) where x > y
```

Going further, we can have general boolean expressions as facts:
```
1 + 2 < f
$huh in g
```
These expressions, and all expressions equivalent to them, are assumed to be true.

We can define inductive and coinductive (?) judgements
```
nat(0).
nat(s(x)) :- nat(x).

unnat(x) :- not nat(x)
```
We could query facts directly:
```
query reachable(1,2)
```
Or query sets of values if there are unbound identifiers, possibly with constraints:
```
query reachable(1, x) where x!=2
```

We can also inspire extension by other kinds of logic, like modal (temporal, dynamic, hybrid) logic, linear (substructural) logic, separation logic, graded variants, probabilistic logic, least and greatest fixed point.

We may add/remove/update facts as we continue the program.

https://www.postgresql.org/docs/current/index.html
Following database interpretation, we can enrich querying syntax. Aggregation, grouping, distinct, nulls?, foreign keys, transactions, primary keys/uniqueness, joins, window functions, order, limit, offset

Once we follow replicate at least prolog semantics, we already gain turing completeness.

Roman Храновський, [1/7/2026 11:27 PM]
HoLogic programming - unifying types and values in db scope. 
Db - explicit rdbms concepts. 
Least fixed point as push updates, greatest as pull based (iterator like).
Dataflow as graph representation of a single function - has a set of arguments and a single output, that are passed and read simultaneously. 
Reactive is a push based graph.
Logic is pull based?

Roman Храновський, [1/7/2026 11:28 PM]
Caching as materializing views/relations/types

Roman Храновський, [1/7/2026 11:29 PM]
Separate storage of facts from rules?

Roman Храновський, [1/7/2026 11:29 PM]
Or rows from tables
https://www.reddit.com/r/Compilers/s/pcji5zcOt7

https://www.google.com/search?q=coalgebraic+modal+logic&oq=coalgebraic+modal+logic&gs_lcrp=EgZjaHJvbWUyBggAEEUYOTIICAEQABgNGB4yCAgCEAAYFhgeMgwIAxAAGAgYChgNGB4yCggEEAAYgAQYogQyCggFEAAYgAQYogQyCggGEAAYgAQYogQyCggHEAAYgAQYogQyCggIEAAYgAQYogTSAQgxMDI4ajBqN6gCFLACAfEFYoBxS8lPsA8&client=ms-android-xiaomi-rvo3&sourceid=chrome-mobile&ie=UTF-8

https://iccl.inf.tu-dresden.de/w/images/e/e1/The_Basics_of_Display_Calculi_%28PrePrint%29.pdf

https://www.logic.at/staff/agata/surveyhypdispl.pdf?utm_source=chatgpt.com

https://arxiv.org/pdf/1609.05343

https://www.postgresql.org/docs/current/rules.html
