Coercion is an operation that converts value of one type to another type.
It is distinct from subtyping, which is a relation between types.
Coercion is a relation between values of types.

That way we can have types that are not subtypes of each other, but still can be used in place of each other.
It just means that the code will need to do conversion before using the value? which implies performance overhead.

Constraint on variables can be coercion, which is a weaker relation than subtyping in that case.
When resolving such constraint, we may choose one of types to be the base, and must find such type that will require least coercions overall.

Coercible types always have common supertype, a union all inter-coercible types.
But values of such types are not considered as simultaneously values of all inter-coercible types.