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

# Co-inductive types

Types that are useful to represent infinite data structures, like streams, trees with infinite branching, etc.
Defined in similar way to inductive types as a set of constructors? 
Should be a set of destructors somehow

An example of a stream:
```
stream a = node(item: a, tail: stream a)
```
That is exactly a type of lists, but without a variant for empty lists, implying that there is no end to available data.

That poses a problem for constructing values of that type, since it can't be built up from the bottom as usual.
Thus any instance relies on infinite recursion and lazy evaluation, that allows it not to loop infinitely to gather all available data, but to take it one by one as it is required.
An example of constructing infinite stream:
```
repeat x = node x (repeat x)
```
It will only work, if recursive call is evaluated when its value is actually needed. If it is greedy, then it's gonna loop forever through recursion.

it is used the same way a regular list is used, but "base case" is dropped, since there is no variant for it in data type.
```
map stream f = match stream {
	node(item, tail) -> node(f item, map tail f)
}
take stream n = if n!=0: match stream {
	node(item, tail) -> [item, ...take n-1 tail]
} else []
```
https://cs.stackexchange.com/questions/525/what-is-coinduction
https://cstheory.stackexchange.com/questions/10594/whats-the-difference-between-adts-gadts-and-inductive-types