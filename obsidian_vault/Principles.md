Main language design principles:

1. Must have native support for [[Design patterns|design patterns]]. It should be trivial to use these patterns.
2. [[Expression based]] - all items are expressions that return values.
3. [[Dependency Injection]] for basic features like records, tuples etc.
4. No [[Leaky abstraction|leaky abstractions]].
5. Supports [[Zero-cost abstraction]].
6. May run completely in [[compile-time]], when does not depend on any external data.
7. Should minimize [[nesting]].
8. Should encourage [[programming best-practices]].
9. Must allow to choose [[Runtime cost ratio]].
10. Types are first class values and all values are usable types.
11. Types must be completely optional, while preserving typesafety.