basic constructs of the language:
1. Values
    1. Primitive
    2. Composite
2. Expressions
2. Types
3. Environments
    1. Declarations
    2. Closures
4. Modules
5. Effects
6. Threads?
7. Patterns
    8. lenses?
8. Databases/Flows/Fixpoints/State-machines.
9. Annotations
10. Memory/Heap?

Each of the constructs has its own syntax and expression semantics. All of them must compose with every other construct.

that means answering how other constructs can be used as the current, how are other constructs interpreted when composed under this construct and vice versa.

Let's walk through each of them and define their interactions.

## Values
The most basic straightforward. Primitives define basic datatypes the program operates on. Composites store or handle primitives in some particular way.

## Expressions

combinations of values and operators that produce another value.
every value can be written as an expression and every expression eventually reduces to a value.

expressions themselves can be syntactic values that can be explicitly evaluated or can be abstracted over with function values.

## Types
Types define the shape of values. Semantically interact with values through first-class types and singleton value types.

Every value can be made into a singleton type containing itself.
Every type can be made into a value and manipulated as such.

We can also check value against a type, and get whether the value is of the given type.

Otherwise they interact with expressions the same way as values.

## Environments
environments define evaluation context of expressions. formally they are mappings from symbols to values.

that makes symbols and environments another kind of values.

they are typed with type environments.

modified through declarations, scopes, assignments.
stored through closures.

can any value be interpreted as environment?

## Patterns 
defines how to destructure the value into declarations and assignments to be bound in the environment, and defines how the new variables are constrained.

they are typed as existentials for each free variable constructing type of values that are matchable.

they can be an expression producing a pattern value, which encodes free variables being bound after matching. it can be substituted everywhere, where we expect a pattern.

any value can be interpreted as pattern matching exactly this value.

expressions can be interpreted symbolically as searching for values that when substituted into expression will produce the matched value. or it can be syntactic template destructuring the expression syntax value.

environments?

## Fixpoints
values describe rows/facts
types describe tables/propositions.
expressions?
patterns?
environments?

can be used as a graph value/orm/db.
typed with schema describing what types it encompasses and what are the constraints.

in expression can be used to execute queries on it or as a value.

in patterns?
as envs?

