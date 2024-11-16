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
3. Uniqueness - if reference is the only reference to underlying value. That allows opaque in-place mutations. A dual invariant affinity - if reference must be used exactly once or it can be reused. For example to prevent leaks a cleanup function must be called exactly once which allows to preserve uniqueness after function call.
5. Contention - if reference can be safely read from or written to. In a multithreaded context, writes and reads create data-race conditions, so knowing if given reference is contended is useful to prevent such race conditions. A dual invariant portable - if reference can be safely moved through thread border, which allows to preserve contention after function call.
6. Mutability - if reference can be changed. If value is immutable, then many other modes can be assumed as well.

Dual invariants are essentially invariants for input and output values of a function respectively.
Modes can have a submoding relation, similar to subtyping for types. Any submoded value can be used in place of mode value.
If different mode axis interfere, such that some combinations are considered invalid (like closure containing local values cant be global)
Modes for references and their content not always related, assuming otherwise can read to unsoundness.

Different invariants can be combined together to create a full description of restrictions on given value.