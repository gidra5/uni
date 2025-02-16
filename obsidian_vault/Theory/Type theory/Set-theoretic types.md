
Basic set-theoretic types:
1. intersection type with `and` operator. Associative
2. union type with `or` operator. Associative
3. negation type with `not` operator
4. Bottom type `void`.
5. Top type `unknown`. 

Subtyping relation `<:` is defined:

1. `a <: unknown`
2. `void <: a`
3. `a and b <: a, a and b <: b`
4. `a <: a or b, b <: a or b`
5. if `a <: not b` then `b` and `a` are disjoint

useful relations:
1. `a and b = a` if `a <: b`
2. `a or b = b` if `a <: b`
3. `not a <: not b` if `b <: a`
4. `unknown = not void`
5. De-morgan's law `not (a or b) = not a and not b`
6. Double negation `not not a = a`
7. Disjoint intersections `(a -> b) and (c -> d) = (a and not c -> b) and ((a -> b) or (c -> d)) and (not a and c -> d)`
8. Union of functions `(a -> b) or (c -> d) = a and b -> b or d`

https://inria.hal.science/file/index/docid/76261/filename/RR-0296.pdf

Set theoretic types: https://www.irif.fr/~gc/papers/set-theoretic-types-2022.pdf 
Types that allow set-theoretic operations to be performed with them, such as `union`, `intersection`, `negation` of some types

