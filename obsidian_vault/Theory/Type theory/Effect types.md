Effects are interfaces that define methods that should be implemented.
For OOP folks that is what Dependency Injection was doing.
Effect interfaces are nominal. So an effects with the same methods is distinct from each other, because the methods may have different semantics.
Effect interfaces may be anonymous as well, in which case they are treated by type system as records with function values stored as method names.

Any function may use injected methods as long as they are specified in type of that function as the expected effect.
The effect is set of associated effect methods that are required to be provided by the calling scope for it to be callable.
Thus if the caller neither provides the methods, nor expects the required methods in its expected effect context, then method is not callable and such code produces error.
Methods are added to the expected context by calling them, and removed by implementing them.
And looking from the opposite side, provided methods are added by implementing them, and removed when going out of scope or masked.

Effect methods may be masked out from context so that the internal implementations does not interfere with outer implementations when function is called.
Effect methods must be implemented by handlers, that are installed at some point in call-stack.

Effect types can be composed with set-like operations:
1. union - both effects are performed.
2. intersection - only common effects are performed.
3. negation - effect is not performed.

Some effects are unrecoverable (like destroying a file), which means they cannot be reverted exactly once done. In some cases being exact is not necessary, but its not always the case. That places restrictions on how effects emitted before it can be handled - they cannot be handled more than once, because the exact state of continuation cannot be restored. There are ways to mitigate this, like evaluating effects in temporary environment, reverting them manually, or simply marking them as non-critical (they can be allowed to not be restored). That also places restriction on result of the continuation, because once such effect is performed its result cannot be implicitly discarded, so it must be used in some way.

Coeffects are about requirement to the environment. That is, to be able to call a function, environment must be suitable for it.
Coeffects sometimes can be modeled by modalities.

https://vhyrro.github.io/posts/effect-systems/
https://dl.acm.org/doi/pdf/10.1145/3607846

effect subtyping? lets say we have separate effects for each type of errors that may occur, they it would be convenient to define a single generic effect handler for error that would be able to handle all of the "derived" error effects