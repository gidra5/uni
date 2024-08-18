Effects are interfaces that define methods that should be implemented.
For OOP folks that is what Dependency Injection was doing.
Effect interfaces are nominal. So an effects with the same methods is distinct from each other, because the methods may have different semantics.
Effect interfaces may be anonymous as well, in which case they are treated by type system as records with function values stored as method names.

Any function may use injected methods as long as they are specified in type of that function as the expected effect context.
The effect context is set of associated effect methods that are required to be provided by the calling scope for it to be callable.
Thus if the caller neither provides the methods, nor expects the required methods in its expected effect context, then method is not callable and such code produces error.
Methods are added to the expected context by calling them, and removed by implementing them.
And looking from the opposite side, provided methods are added by implementing them, and removed when going out of scope or masked.


Effect methods may be masked out from context so that the internal implementations does not interfere with outer implementations when function is called.
Effect methods must be implemented by handlers, that are installed at some point in call-stack.

https://vhyrro.github.io/posts/effect-systems/