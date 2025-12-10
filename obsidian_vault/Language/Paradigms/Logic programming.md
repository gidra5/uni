
https://simon.peytonjones.org/assets/pdfs/verse-conf.pdf
https://arxiv.org/abs/2405.19040
https://www.curry-language.org/
Prolog
https://www-ps.informatik.uni-kiel.de/~mh/papers/WLP24.pdf

https://www.lix.polytechnique.fr/Labo/Dale.Miller/lProlog/
unification

https://www.michaelhanus.de/papers/GanzingerFestschrift.pdf

At its core, _pure_ logic programming (à la Prolog without cuts, I/O, etc.) consists of:
1. **Nondeterministic search**
2. **Logical variables**
3. **Unification (constraint solving)**
4. **Conjunction and disjunction of goals**
5. **Backtracking / exploration strategy**
6. **Observation (answers / substitutions)**

Logical variables can be interpreted as a co-structure for function variables. Instead of waiting for an instance of an argument, we *generate* examples of such variables based on the body.

Logical variables by itself are not enough, we also need unification over these variables. Unification is a generalization of pattern matching and destructuring, which can also consider arbitrary functional computations for matching, and not just data structures.
https://foones.github.io/files/pub/2020-ICTAC-Semantics_of_a_Relational_Lambda_Calculus.pdf

https://scholarworks.iu.edu/iuswrrest/api/core/bitstreams/27f1ebb8-5114-4fa5-b598-dcfaddfd6af5/content
https://minikanren.org/workshop/2021/minikanren-2021-final8.pdf

`last l = (free xs, e: (...xs, e) == l).e`
`link (free xs, e: (...xs, e) == l).xs (free l, e: (e,) == l).l` ->
`free xs, e, l, e2: (...xs, e) == l && (e2,) == xs`
`eliminate (free xs, e: (...xs, e) == l).e 1` ->
`free xs: (...xs, 1) == l`
`eliminate (free xs, e: (...xs, e) == l).xs (free l, e: (e,) == l).l` ->
`free xs, e, l, e2: (...xs, e) == l && (e2,) == xs`
`constraint xs, e, l, e2: (...xs, e) == l && (e2,) == xs`
`interface xs, e, l, e2: (...xs, e) == l && (e2,) == xs`

https://dl.acm.org/doi/pdf/10.1145/3677999.3678279
https://publishup.uni-potsdam.de/opus4-ubp/frontdoor/deliver/index/docId/3957/file/wlp09_S1_15.pdf
https://www.cambridge.org/core/services/aop-cambridge-core/content/view/AB57FF99CEA76C1C31A336B560D6FD3C/S0956796809007321a.pdf/algebras-for-combinatorial-search.pdf
https://web.archive.org/web/20240411205931/https://www.informatik.uni-kiel.de/~mh/papers/PPDP22.pdf