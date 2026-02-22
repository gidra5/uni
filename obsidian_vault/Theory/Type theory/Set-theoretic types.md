
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

Intersection types can be used to model trait impl resolution.
https://www.semanticscholar.org/reader/202989c58bd6db257fa8f659b6fcbd474fcd6d6f

While intersection types naturally model subtyping, they cannot model trait composition the same way without any changes. One distinct feature of traits that distinguishes them from regular subtyping is that traits can be implicitly composed. That is we may derive implementations for a trait from other implementations, but not force the user compose them explicitly by passing around instances in some form.
The insight that allows us to extend intersection types to model trait composition is to follow implication rules (aka modus ponens). So then we can also define compositional subtyping in a form of `a and a -> b <: b`. That basically means we can implicitly compose overloads to get other behaviors.
While the idea is intriguing, we must take care to preserve ordering of subtyping relation. Notably it can cause instability of resolution - depending on where subtyping is resolved, the result of resolution can be different.
But the payoff is worth the hussle. We may then model first-class environments as intersection types and use them as values. Besides that, we actually unify the two approaches for implicit polymorphism that way - subtyping and traits.

Environments point are worth exploring deeper. Given for example a task of parsing an array of numbers and strings, we could define a trait `Parser` that defines a method to parse a value of a given type. The parsers for numbers and strings are what you would expect, but for union and array of types, we must compose traits. And since traits are global, this implementation must be unique for a particular instantiation. But the format for string array may be different for each parser, which means there is no canonical, unique implementation. By making the implementations named and combined into a single value (environment) through merge, we can build a parser for out particular syntax, without enforcing a globally unique implementation. 

One of the downsides is the need to explicitly pass the parser around, although it can be mitigated by using effect handlers. Another one is that it is unclear how to create traits with multiple interconnected methods that way. We can define a trait with a single method that has multiple instances, but not with multiple methods.

Note that for this idea to work, we also expect a term for "merging" two values be defined. Meaning we indeed could construct a term that is, for example, both a number and a string. The two values are disjointly combined into a single value operating as the intersection of the two types. At this point, coercion becomes just a projection operator for that merge. 
Note that now having ability to merge arbitrarily, the type becomes a multiset, which introduces an ambiguity if there are two values of the same type merged. Thus we pose a restriction on the merge - two values must have disjoint types, meaning their supertype (or subtype?) is `void` and it is the only one. Furthermore, it is enough to prove coherence and stability, that there are no more such ambiguities.

But actually, coherence and stability are being invalidated once we allow modus ponens rule to be applied. Since any function could be coerced into application, the results of such functions should be disjoint from the other members of the intersection. That basically covers the fact that any higher order instances must not interfere with other instances once they are given a concrete type. We might want to distinguish cases when the intersection may or may not allow for modus ponens, but that requires even more complexity. And even if the types overlap, their values may be equal, which means any resolution path leads to the same result.

These cases, if not eliminated otherwise, require us to explain how the typechecking might've failed due to these constraints.

This idea already brings us the complete first order logic power, but we can extend it further into higher order logic, I believe. We may model judgments with intersection types and subtyping relation as is illustrated by modus ponens. Resolution can be seen as proof search, connecting us to logic programming paradigm. That also means that now we don't actually interpret these as set operations, but rather as logical ones.

Elaboration is a process of transforming a program by making some operations explicit. For example allocations, scopes, closures, coercions, implicit parameters, etc.