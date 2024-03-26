# Primitives
Basic types are:
1. `number` (`int` and `float`)
2. `string`
3. `boolean`
4. `symbol`
5. `void` - a type that represents values that cannot be produced, used, or that are just invalid.
6. `unit` - empty tuple

## Numbers
Numbers are representation-agnostic datatype. Which means parameter of that type may be represented as `float`, `int`, etc., and they can have different sizes (`int8`, `float16`).
`number` is a common interface for all these representations, that allows arithmetic, comparison and conversion between all of them.
Conversions obey following rules:
1. `uint_n` convertible to `uint_2n`
1. `uint_n` convertible to `int_2n`
1. `int_n` convertible to `int_2n`
2. `int_n` convertible to `float_2n`
2. `float_n` convertible to `float_2n`
2. `uint_n` convertible to `float_2n`

Generally rules can be described as "always convert to wider type, either in possible types of values or in size"
Backwards conversions must be explicit, since they are lossy.

Here are some examples:
```
>> typeof 1
uint8
>> typeof 1.2
float16
>> -1
int8
>> 1 + 1.2
2.2
>> typeof (1 + 1.2)
float16
>> typeof (2^32 + 1.2) // they are both converted to common number type and then added
float64
>> typeof (float32(2^32) + 1.2) // same as prev but with explicit cast to narrower type
float32
```

Number literals consist of digits `_` as separator and optional `.` as fraction separator. Lead and tail zero both optional.
## Symbols
Symbols are unique identifiers. For example:

```
>> x := symbol // assign symbol to variable
#x
>> symbol == x // symbols are unique values
false
```

## Booleans
Booleans are simplest datatype defined as union of two possible values `true` and `false`, which are themselves global symbolic constants.

## Strings
Strings are sequences of characters delimited by `"`. They can be any characters encodable in utf-8. Strings with single character are considered to be `char`s, which is a "single char" string

# Derived types

1. Intersection types - the type that must adhere to both of input types
2. Union types - the type that must adhere to at leas one of the input types.
3. Negated types - the type that represents anything that is not the input type
4. Nominal types - a type that is distinguished from the input type only by its name.
5. Algebraic data types - records, enums and any combination thereof.

# Subtyping
