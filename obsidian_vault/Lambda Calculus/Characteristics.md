Characteristics of interest for any type theory\lambda calculus:
1. Normalization - does all terms reduce to some irreducible normal form? Does reduction terminate for all terms? Does normal form depend on the choice of reductions, is normal form unique?
2. Soundness - is it possible to receive argument that is not a member of expected type?
3. Equality of terms - is it possible to decide if two terms are equal?
4. Consistency - is it possible to provide term of an empty type (void)?
5. If term `a` reduces to term `b`, do they inhabit the same type?
6. is reduction an equivalence relation
7. Subject reduction - reduction of a term preserves its type.
8. How does it describe what values are stored in variable?
9. How does it describe how given values can be used?
10. How does it describe interaction with environment?
11. Ad-hoc polymorphism coherence - Every different valid typing derivation for a program leads to a resulting program that has the same dynamic semantics.
12. Is type inference decidable? Does inference algorithm based on given typing rules terminate?

Given a value we want to know:
1. How it is stored (for example with algebraic types)
2. What interfaces does it satisfy (for example with abstract or generic types)
3. Where can it be used (using subtyping for example)
4. How can it be used (with linear or modal types)
5. How it changes when we interact with it (via session types for example)