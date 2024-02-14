Basic types (aka primitives) with examples are:
1. `number` (`int` and `float`)
1. `string`
1. `boolean`
1. `symbol`
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
Symbols are unique scoped identifiers. That means that any instance of symbol is identified by its name and scope of definition. For example:

```
>> x := #x // assign symbol to variable
#x
>> { #x } == #x // symbol literals from different scopes are unequal
false
```

Symbols can be lifted with multiple `#`, which means they can refer to the symbol in scopes above:

```
>> { ##x } == #x // true because ##x is lifted to the outer scope
true
```
## Booleans
Booleans are simplest datatype defined as union of two possible values `true` and `false`, which are themselves global symbolic constants.

## Strings
Strings are sequences of characters delimited by `"`. They can be any characters encodable in utf-8. Strings with single character are considered to be `char`s, that can be converted back to string when needed.

   