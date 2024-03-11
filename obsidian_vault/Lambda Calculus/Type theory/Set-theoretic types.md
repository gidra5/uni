
Basic set-theoretic types:
1. intersection type with `and` operator.
2. union type with `or` operator.
3. negation type with `not` operator
4. Bottom type `void`. `a and void = void`
5. Top type `unknown = not void`
6. De-morgan's law `not (a or b) = not a and not b`
7. Double negation `not not a = a`

Subtyping relation `<=` is defined:

1. `a <= unknown`
2. `void <= a`
3. `a and b <= a, a and b <= b`
4. `a <= a or b, b <= a or b`
6. if `a <= b` then `not b <= not a`

https://inria.hal.science/file/index/docid/76261/filename/RR-0296.pdf

Set theoretic types: https://www.irif.fr/~gc/papers/set-theoretic-types-2022.pdf 
Types that allow set-theoretic operations to be performed with them, such as `union`, `intersection`, `negation` of some types
