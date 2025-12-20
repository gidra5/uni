Main language design principles:

1. Must have native support for common [[Design patterns|design patterns]]. It should be trivial to use these patterns.
2. Prefer expression semantics instead of statement semantics - return meaningful values for any construct.
3. Dependency Injection for language features like records, tuples etc.
4. Minimize [[Leaky abstraction|leaky abstractions]]. User should not be forced by language features to touch lots of locations just because he changed single part of that program.
5. Supports [[Zero-cost abstraction]]. User should be able to precisely control cost of any abstraction and to make them transparent, so that they do not add more code the is written.
6. May run completely in compile-time, when does not depend on any external data.
7. Should minimize syntactic nesting.
8. Should encourage programming best-practices.
9. Must allow to choose [[Runtime cost ratio]].
10. Types are first class values and all values are usable types.
11. Types must be completely optional, while preserving soundness.
12. Formatting independent semantics
13. Preference for unambiguous code with exceptions to cases when it doesn't impact maintainability. Special-cases are sometimes a form of ambiguity, thus also need to be avoided
14. Must satisfy Principle of Equal Power.
15. Must be semantically complete. There must be semantic closure over all the operations available.
16. There must a single optimal, idiomatic way to solve a problem. 
17. Preserve duality in concepts.
18. Do not enforce cluttering of syntax and semantics with what can be inferred.
19. If there is a semantic design choice, you should delegate this choice to the user. Provide both options and allow user to choose whichever is more suitable.
20. The programs and algorithms should be expressed in domain specific languages. Most general DSL are the models of computation, all providing equal power, yet able to express things differently and optimally in their domain. Thus it is essential to allow expressing the computation in a different model naturally, without reimplementing it, providing a common, unifying ground for the maintainability and readability of code. Additional benefit of having multiple models in one language, is exposure to different paradigms, that can ultimately give 

https://en.wikipedia.org/wiki/Zen_of_Python
https://ceronman.com/2012/09/17/coffeescript-less-typing-bad-readabilityconcepr/
https://cln.co/
https://youtu.be/RNZeAmp1EaA?si=PtCQ2Bn2N3391b84
https://journal.stuffwithstuff.com/2013/08/26/what-is-open-recursion/
https://cs.lmu.edu/~ray/notes/languagedesignnotes/
https://flix.dev/principles/
https://blog.flix.dev/