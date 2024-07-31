Any type system has a notion of soundness - whether it is possible for variables to have values that are not allowed by their type.
For simple type systems like simply typed lambda calculus it is possible to prove formally that it is sound.
But in real world programming languages have many interleaved features, which makes it much harder or even impossible to prove.
Nevertheless we expect it to be true at all times and some guarantees or optimizations may depend on that assumption. Failing to provide sound type system may cause really annoying errors.

[counterexamples](https://counterexamples.org/intro.html)