https://langdev.stackexchange.com/questions/412/what-are-the-advantages-of-using-dependent-modal-types-in-a-language
https://en.wikipedia.org/wiki/Modal_logic

https://ncatlab.org/nlab/show/modal+type+theory
https://www.researchgate.net/publication/251696615_On_a_Modal_l-Calculus_for_S41/fulltext/00006a6e0cf23f86393c643e/On-a-Modal-l-Calculus-for-S41.pdf
https://blog.janestreet.com/oxidizing-ocaml-locality/
https://richarde.dev/papers/2025/drfcaml/drfcaml.pdf
https://antonlorenzen.de/mode-inference.pdf

can be used to represent a possibility of some value. For example if the value is not available right now, but there is a computation that will produce it. Thus it can be useful to represent type of expressions that are yet to be evaluated. Since the expression may contain infinite loop, it is only a possibility that such value will actually arrive.

they are also useful to represent invariants about variables

invariants include:
1. locality - value does not escape the scope of variable containing it. It can escape for example through return value or be stored in a variable outside the scope.
2. Affinity - if reference must be used exactly once or it can be reused. For example to prevent leaks a cleanup function must be called exactly once.
3. Uniqueness - if reference is the only reference to underlying value. That allows opaque in-place mutations.
4. Portable - if reference can be safely moved through thread border
5. Contention - if reference can be safely read from or written to.
6. Mutability - if reference can be changed.