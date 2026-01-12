The type system is total, meaning that every syntactic construct has a type assigned.
If the construct is semantically meaningless or invalid, the type is `void`.
Values of type `void` are not observable - you cannot use it to produce non-void values.
Since they are not observable, they can be safely ignored and erased from the code.
We can be strict and disallow writing `void` values, or we can be lenient and allow, only considering it to be an error if the whole program is of type `void`.
We can also allow debug runs, that don't check for type errors, and in case of evaluating a `void` value, print a warning (unless explicitly ignored with `void` operator) and produce a dummy `null` value. Additionally, we can run strict debugging, where evaluation of `void` values is an error that terminates the program.

We can intuitively think of `null` as a value of ill-typed expressions. By definition, it is not in the domain of values for well-typed expressions. So, as far as well-typed expressions are concerned, `void` type is not inhabited. Only in ill typed expressions `void` is inhabited.

We can intuitively think of `void` type as a type of non-observable expressions. we don't want to observe ill-typed expressions, so they must have `void` type. But that also means, that non terminating expressions, like infinite loops or recursion, are also of `void` type, since we can't observe their result.

`null` can also be interpreted as "undefined" value, a result of evaluating "undefined behavior".
It must be provable that any valid program does not depend on the value of `null` expressions. We can fuzzy test it by using random values each time and checking if the program changes its behavior. (bisimulation, operational equivalence, behavioral equivalence)

Basic algebraic types:
1. Tagged union type with `union` applied to record or tuple
2. Untagged union with `or`
3. Tuple types with `(type, ...)`
4. Record types with `record { label: type, ... }`
5. Function types with `fn label: type => <effects> type`
6. Nominal types with `nominal` operator
7. Unit type `()`
8. bottom type `void`. 
9.  top type `unknown`. 
10. indexing `record.name` and `tuple[index]`
11. intersection `and`
12. negation `not`
13. traits `trait`. 

Primitives:
1. `number`
2. `string`
3. `boolean`
4. `symbol`
5. `type i`

Subtyping `<:`:
1. 

https://www.reddit.com/r/ProgrammingLanguages/comments/1q895ag/list_of_type_operators/