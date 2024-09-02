Main language design principles:

1. Must have native support for common [[Design patterns|design patterns]]. It should be trivial to use these patterns.
2. Prefer expression semantics instead of statement semantics (try to return meaningful values for any construct).
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