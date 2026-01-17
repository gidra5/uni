Any type system has a notion of soundness - whether it is possible for variables to have values that are not allowed by their type. More formally a type system is sound if every closed well-typed expression is safe (i.e., has well-defined behavior).
To be safe, any state reachable from a given closed well-typed expression is progressive.
A state is progressive if it is either finished with value with a type of initial expression, or it is reducible into another state.
For that to be true it needs to be proven that well-typed states are progressive and that reduction preserves well-typedness of states.
well-typed state is a state whose context and expression are well-typed. 
Context is well-typed when all names carry values that inhabit type associated with the name.

For simple type systems like simply typed lambda calculus it is possible to prove formally that it is sound.
But in real world programming languages have many interleaved features, which makes it much harder or even impossible to prove.
Nevertheless we expect it to be true at all times and some guarantees or optimizations may depend on that assumption. Failing to provide sound type system may cause really annoying errors.

[counterexamples](https://counterexamples.org/intro.html)

https://robbertkrebbers.nl/research/articles/logical_type_soundness.pdf
https://blog.sigplan.org/2019/10/17/what-type-soundness-theorem-do-you-really-want-to-prove/
https://logan.tw/posts/2014/11/12/soundness-and-completeness-of-the-type-system/