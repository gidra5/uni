A type that is taken as an axiom of the system.
For example, a type of natural numbers.

Sometimes it makes sense to have a "bottom" type for every primitive type, as well as a "top" type.
"bottom" typed values can be used to represent "impossible" values, such as NaN for floats.
"top" typed values can be used to represent "any possible" values, which is usually the type itself.

If type system has singleton types for every value, then they are considered subtypes of some primitive type.