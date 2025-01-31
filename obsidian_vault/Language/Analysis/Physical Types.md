Types that represent how data is stored. They count in the layout, indexing of data, and data size.
Every physical type has finite size in bytes, that can be calculated at compile time.
These are possible physical types, that can be mapped into LLVM types:
1. `void` - zero sized type, has no representation in physical memory
3. `int` - signed integer type, with given size in bytes
4. `float` - floating point type, with given size in bytes
5. `pointer` - pointer to another type. Size is 8 bytes. 
6. `fn` - function type, with given list of arguments, return type, and a tuple of closure variables. Size is (ptr size + closure tuple ptr)
7. `tuple` - tuple type, with given list of types. Size is sum of element sizes. 
8. `array` - array type, with given type and length. Size is (length * element size). The same as monomorphic tuple.

More interesting types that were inferred must be in some way lowered to these types. For example:
1. Algebraic data types are lowered to tagged unions. That is a tuple of a tag and a value.
2. Records are lowered to tuples with additional index table. If its possible to statically determine the index of a field, then table can be omitted.

Physical types can be checked for validity the same way as regular types.

https://osa1.net/posts/2023-01-23-fast-polymorphic-record-access.html
https://alic.dev/blog/dense-enums
https://dl.acm.org/doi/pdf/10.1145/316158.316183