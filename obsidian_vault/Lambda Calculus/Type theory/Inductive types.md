Types that are defined by a set of constructors and literals, that do not require explicit implementation of some kind, and they are matched on directly.

They cover usual algebraic data types, but offer more flexibility/power, maybe?

They are supposed to be dual to inductive types, so maybe it represent all finite types? The ones that can be fully traversed without creating infinite loop, or some non-terminating computation.

As an example can be taken type of lists:
```
list a = 
	empty,
	node(item: a, tail: list a)
```
Its a generic type with two variants - an empty list `nil` and a node with an item and a tail.

https://cs.stackexchange.com/questions/525/what-is-coinduction
https://cstheory.stackexchange.com/questions/10594/whats-the-difference-between-adts-gadts-and-inductive-types