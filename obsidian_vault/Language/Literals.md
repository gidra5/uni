## Tuples

Heterogeneous, ordered, push-based [[Composites|sequence]].

Created similarly to python, with `,` operator

## Records

created similarly to Tuples, but all elements must be labeled expressions. 
Labeled expressions are
`expression: expression`

## Dictionaries

Dynamic counterpart of Records

## Arrays

Dynamic and homogenous counterpart of Tuples.

## Streams

Pull-based iterators. 

## Iterators

Push-based iterators.

## Slices

A fat-pointer into some array.

## Sets

Unordered counterpart of Tuples.

## Functions

An abstraction of computation

## Macros

An abstraction over dynamic environments and AST.

## Channel

A communication primitive between threads

## Signals

A reactive value that can be subscribed to and that will emit events on its change.

## Symbol

A value that is guaranteed to be unique across the program.

## Reference

A value that references some other value.

## Number
### Integer

A natural number. Can be signed/unsigned, bound/unbound.

### Float

A real number, can be signed/unsigned, bound/unbound, modulo larger/smaller than 1.

## Text
### String

Sequence of characters spanning one line

## Character

A single utf-8 character

### Multiline string

Sequence of characters spanning multiple lines

[multiline string syntax](https://www.reddit.com/r/ProgrammingLanguages/comments/w8zjc2/an_idea_for_multiline_strings/)
[c# multiline strings](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/strings/#raw-string-literals)
https://www.reddit.com/r/ProgrammingLanguages/comments/932372/how_to_implement_string_interpolation/