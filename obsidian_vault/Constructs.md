basic constructs of the language:
1. Values
    1. Primitive
    2. Composite
2. Types
3. Environments
   1. Declarations
   2. Closures
4. Modules
5. Effects
6. Threads?
7. Patterns
8. Databases/Flows/Fixpoints/State-machines.
9. Annotations
10. Memory/Heap?
11. TAST?

Each of the constructs has its own syntax and expression semantics. All of them must compose with every other construct.

Let's walk through each of them and define their interactions.

## Values
The most basic straightforward. Primitives define basic datatypes the program operates on. Composites store or handle primitives in some particular way.

## Types
Types define the shape of values. Semantically interact with values through first-class types and singleton value types.

Every value can be made into a singleton type containing itself.
Every type can be made into a value and manipulated as such.

We can also check value against a type, and get whether the value is of the given type.