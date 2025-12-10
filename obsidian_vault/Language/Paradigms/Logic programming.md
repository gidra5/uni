
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

`last l = (free xs, e: (...xs, e) = l).e`
`link (free xs, e: (...xs, e) = l).xs (free l, e: (e,) = l).l` ->
`free xs, e, l, e2: (...xs, e) = l && (e2,) = xs`
`eliminate (free xs, e: (...xs, e) = l).e 1` ->
`free xs: (...xs, 1) = l`
`eliminate (free xs, e: (...xs, e) = l).xs (free l, e: (e,) = l).l` ->
`free xs, e, l, e2: (...xs, e) = l && (e2,) = xs`
`constraint xs, e, l, e2: (...xs, e) = l && (e2,) = xs`
`interface xs, e, l, e2: (...xs, e) = l && (e2,) = xs`

https://dl.acm.org/doi/pdf/10.1145/3677999.3678279
https://publishup.uni-potsdam.de/opus4-ubp/frontdoor/deliver/index/docId/3957/file/wlp09_S1_15.pdf
https://www.cambridge.org/core/services/aop-cambridge-core/content/view/AB57FF99CEA76C1C31A336B560D6FD3C/S0956796809007321a.pdf/algebras-for-combinatorial-search.pdf
https://web.archive.org/web/20240411205931/https://www.informatik.uni-kiel.de/~mh/papers/PPDP22.pdf
https://www.cs.cmu.edu/~fp/papers/negpat02.pdf
https://web.archive.org/web/20250601164736/https://www.cs.ox.ac.uk/people/samuel.staton/papers/fossacs13.pdf

https://dario-stein.de/thesis.pdf
unification strategy through effect handler

https://pdf.sciencedirectassets.com/271538/1-s2.0-S0304397500X05312/1-s2.0-S030439750300392X/main.pdf?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEAwaCXVzLWVhc3QtMSJGMEQCIF%2BhYESdBUNw%2F40M2aRA0cpBO4DUYrM2Pinnxg0FDjGtAiAriBLSpRDNsh%2FGnJt%2BjII%2F55V1IcWfQH64N9izCnjxsiq7BQjU%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAUaDDA1OTAwMzU0Njg2NSIMuy4Jtr0gdvf1FVbUKo8Fc9qtUNmt%2FKZ1B4U%2BOijNpOvahs%2FWrJcmnVcWbw9pVUbDxoEr6%2B%2BnDFA0PREa%2BLFb8Iv6Gt0JVtpXBgGZh7cHUy4ipZo%2FyAE6siTBbDZfrxSGS0ITAsoc3qGyUU8neNTihFhXDY9%2BvdPdTANOmVe6BLNXaATACfiTXltPzVPp%2BgMYAtOVOFxou%2BxMyH83WX1F8UMoP%2B8nOFyO2fMXgXa1XwoYsVw9aISi%2Fwo19ePWSfHd%2Bw5UudE5gQXeHfzPnv5uA0t4mjjvc9hY0ooxoz03ehvST086yeJtxu5iGjhqUuzZYdnUgvea85Na%2Bb8G333Xp2YtRSwrO4jjh4bWbkZrBM5Im5drFuKA91wIakvdy2qnlfOjCDe6tZMFv0PkI%2BqrPy9W84C9qhkTHuFlFoEUMqRC3g5FmxtLH0bWc%2B%2FsJdaHFySZb%2B9oQqGx%2FY8UahPZCORhpxttS%2Fa49CkFZ%2BvHhk00BlcMDxv13MDUCSCl8NRZ8ZUz3w6UBfm6LhRMRt87qlUCyDOrXzfP88mElkGIJgz0VZ8eaRaCJmznRKKhhtKXIfHk3FfeiadBRLe%2FnUpx%2B2KNb7MHcFZNyXEcSLwxRt7fd9gM8hcfTS0RS7RAEP75CU%2FPJhImfioSlf5sGlKgGNRXaPvdFw1yKLmdmMwG6NBZDVFNdCbhKeKzLQHoCna76i00CBAf8NL0LtJfwN5SUwJjqRfgdeFLhiQmkZsUBa75ivOteZRxV8O6sN6qSo1fliEQSsO8KXgPPN4wohmj0YvrBLj5ZrZNxhUeUM1GyAkHfL62NUn6WMAoHbHYLKuwCYYiICzS%2BRfQT22fxAucBd2xtF48e%2BG9K5BSpLriQG0tqm260p9Hshloyob9wDCyquXJBjqyAd%2F10HJK7twC3dFJXIutidUa5zwrvseGjWn7nelgz5mjZCMPXUpk%2FRjgwen%2FKmypMrucLt6fuISXPVojVOrdxVs%2FS2WlFiEnK3LjuHOTI6V5GyZjQB1ltjaATZI6jYdtTUgpP5m2piLbn1REo4Urf%2BKvuR7slSEeRQThjuv58TDHRY3TViCTJTMGWIXzvj2DAHp%2FljW85CZJkf57NsVq4SWaRBBmtVWBj3LlnmJJvqMFXFk%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20251210T121443Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIAQ3PHCVTYTYXLDERK%2F20251210%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=0081a2813a7e042c986b8238355b5b7aa6758ef8e7425d7592beb6946604a623&hash=b8fd0b00e7f95a8069d63034834163d5718229906d139762212d0bd15e76e741&host=68042c943591013ac2b2430a89b270f6af2c76d8dfd086a07176afe7c76c2c61&pii=S030439750300392X&tid=spdf-cdb5adaf-d7cd-455e-ad80-061cb82f1637&sid=dabb5f636a14a54ec90ab710927be01bfd73gxrqb&type=client&tsoh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&rh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&ua=0f075f050000015f0003&rr=9abca9df2fecca55&cc=ua

https://scispace.com/pdf/a-pi-calculus-specification-of-prolog-3qf2pf04ud.pdf?utm_source=chatgpt.com
https://dtai.cs.kuleuven.be/projects/ALP/newsletter/may06/nav/articles/ueda/article.pdf?utm_source=chatgpt.com