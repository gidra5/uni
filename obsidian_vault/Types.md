
Basic algebraic types:
1. Tagged union type with `union` applied to record
2. Untagged union with `union` applied to tuple, aliased with `or`
3. Tuple types with `(type, ...)`
4. Record types with `(label: type, ...)`
5. Function types with `fn label: type => type`
6. Nominal types with `nominal` operator
7. Unit type with `()`
8. Void type with `void`. Unit wrt `or` operator.
9.  Unit wrt `and` operator - `unknown`. Any unlabeled param is considered `unknown`
10. Convention: Identifier with `'` are type parameters

Primitives:
1. `number`
2. `string`
3. `boolean`
4. `symbol`

Subtyping relation `<` is defined:
1. `a < unknown`
1. `Value < Type`
1. `a < a`
3. `a and b < a` and `a and b < b`
4. `a, b1, b2, (fn x: a => b1) and (fn x: a => b2) < fn x: a -> (b1 and b2)`
5. `a, b1, b2, (fn x: b1 => a) and (fn x: b2 => a) < fn x: b1 or b2 -> a`
6. `a, b1, b2, a < b1, a < b2, a < b1 and b2`
7. 
```
a1, a2, b1, b2, 
a1 < a2, b1 < b2, 
(fn x: a2 => b1) < (fn x: a1 => b2)
```
7. 
```
for all x, (fn x: a1 -> b1) x < (fn x: a2 -> b2) x then 
(fn x: a1 -> b1) < (fn x: a2 -> b2)
```

Basis of type system is Calculus of Constructions:

1. There is a *Value* which is **Type of propositions**.
2. There is a *Type* which is **Type of types**.
3. There are abstractions `fn x -> f(x)`
4. There is a type of abstractions `fn x => g(x)`
5. There are applications `x y`
6. `x: y` means *x is of type y*.
7. `f(x: t)` means *f with substitution x of type t*

Variables must be assigned a type. Types assigned as follows (inference rules):
1. *Value* is of type *Type*
2. Type of `fn x: t -> f(x)` is `fn x: t => g(x)` where `f(x): g(x)`
3. Type of `fn x: t => f(x)` is `typeof f(x)` where `t: Type or Value`, and given that it follows  `f(x): Type or Value`.
4. Type of `x y` is `g(y)` where `x: fn x: t => g(x)` and `y: t`.
5. If type `x` can be simplified (reduced) to `y`, and `y: Type or Value` then they are considered equivalent. So `f: x` is also `f: y`

Variables may have inferred type from usage:
1. `x` infers `x: a'`
2. `x y` infers `x: fn x: a' => b', y: a'`
3. `x: y` infers `y: unknown`
4. `(fn x: t1 -> f(x)): fn x: t1 => g(x)` infers `f(x: t1): g(x)`
5. `(fn x: t1 => f(x)): t2` infers `f(x: t1): t2`
6. `x: a, x: b` infers `x: a and b`
7. `x: (fn x: t1 => f(x)) and (fn x: t2 => f(x))` infers `x: (fn x: t1 or t2 => f(x))`
8. `x: (fn x: t1 => f(x)) and (fn x: t2 => g(x))` infers `bool: (fn a: Value => fn x: a => fn y: a => a), a': bool, x: (fn x: a' unknown t1 t2 => a' unknown f(x) g(x))`

These are reverse of inference rules basically.
For example:
```
1. x x 

=>
x: c', (2)
x: fn x: a' => b', (3)
x: a' (3)

=> (8)
x: fn x: a' => b',
x: a'

=> (7)
x: a' and fn x: a' => b'



2. fix = fn f -> (fn x -> x x) (fn x -> f (x x))

=>
a'
b', 
(fn f -> (fn x -> x x) (fn x -> f (x x))): (fn f: a' => b')

=> 
a', 
b', 
f: a'
(fn x1 -> x1 x1) (fn x2 -> f (x2 x2)): b' 

=> 
a', 
b', 
c', 
d', 
f: a'
(fn x1 -> x1 x1): fn x1: (fn x2: c' => d') => b',
(fn x2 -> f (x2 x2)): fn x2: c' => d'

=>
a', 
b', 
c', 
d',
f: a',
x1: fn x2: c' => d',
(x1 x1): b',
x2: c',
f (x2 x2): d'

=>
a', 
b', 
c', 
d',
e',
f: a',
x1: fn x2: c' => d',
x1: fn x2: (fn x2: c' => d') => b',
x2: fn x2: c' => d',
x2: c',
f: fn x: e' => d'
x2 x2: e'

=>
a', 
b', 
c', 
d',
e',
f: a',
x1: fn x2: c' => d',
x1: fn x2: (fn x2: c' => d') => b',
x2: fn x2: c' => d',
x2: c',
f: fn x: e' => d'
x2: fn x: c' => e'

=>
a', 
b', 
c', 
d',
f: a',
f: fn x: d' => d'
x1: fn x2: c' => d',
x1: fn x2: (fn x2: c' => d') => b',
x2: fn x2: c' => d',
x2: c'

=>
a', 
b', 
c', 
f: fn x: a' => a'
x1: fn x2: c' => a',
x1: fn x2: (fn x2: c' => a') => b',
x2: fn x2: c' => a',
x2: c'

=>
a', 
b', 
c', 
f: fn x: a' => a'
x1: fn x2: c' and (fn x2: c' => a') => a',
x1: fn x2: c' and (fn x2: c' => a') => b',

=>
a', 
b', 
f: fn x: a' => a'
x1: fn x2: b' and (fn x2: b' => a') => a',

fix = fn f: (fn x: a' => a') -> (fn x1: (fn x2: b' and (fn x2: b' => a') => a') -> x1 x1) (fn x2: b' and (fn x2: b' => a') -> f (x2 x2))




3. a (fn a: Value => fn x: a => fn y: a => a) b (fn a: Value -> fn x: a -> fn y: a -> y) 

=>
(a (fn a: Value => fn x: a => fn y: a => a) b): fn x: a' => b'
(fn a: Value -> fn x: a -> fn y: a -> y): a' => a' = fn a: Value => fn x: a => fn y: a => a

=>
a' = fn a: Value => fn x: a => fn y: a => a
b'
c'
(a (fn a: Value => fn x: a => fn y: a => a)): fn x: c' => fn x: a' => b'
b: c'

=>
a' = fn a: Value => fn x: a => fn y: a => a
b'
c'
d'
a: fn _: d' => fn _: c' => fn _: a' => b'
(fn a: Value => fn x: a => fn y: a => a): d' => d' = Value
b: c'

=>
b'
c'
a: fn _: Value => fn _: c' => fn _: (fn a: Value => fn x: a => fn y: a => a) => b'
b: c'



4. a (fn a => fn x: a => fn y: a => a) b (fn a -> fn x: a -> fn y: a -> y) 

=>
a'
b'
c'
(a (fn a => fn x: a => fn y: a => a) b): fn x: a' => b'
(fn a: c' -> fn x: a -> fn y: a -> y): a' => a' = fn a: c' => fn x: a => fn y: a => a

=>
a' = fn a: c' => fn x: a => fn y: a => a
b'
c'
d'
(a (fn a => fn x: a => fn y: a => a)): fn x: d' => fn x: a' => b'
b: d'

=>
a' = fn a: c' => fn x: a => fn y: a => a
e'
f'
a: fn _: e' => fn _: d' => fn _: a' => b'
(fn a: f' => fn x: a => fn y: a => a): e' => e' = f'
b: d'

=>
a: fn _: e' => fn _: d' => fn _: (fn a: c' => fn x: a => fn y: a => a) => b'
(fn a: e' => fn x: a => fn y: a => a): e'
b: d'
```

Inductive types are translated as follows:
1.  if definition of `Type` references to the type itself - actual definition is wrapped in `fn _Type: typeof Type => definition(_Type)`
2. if definition is a tagged union then define "constructor" for each of them 
```
type Tree = fn node: Value => fn leaf: Value => union (Node: (left: Tree node leaf, n: node, right: Tree node leaf), Leaf: leaf)

Tree = 
	fn Tree: (fn node: Value => fn leaf: Value => unknown) => 
	fn node: Value => 
	fn leaf: Value => 
	fn Node: (
		fn left: Tree node leaf => 
		fn n: node => 
		fn right: Tree node leaf => 
		Tree node leaf
	) => 
	fn Leaf: (fn _: leaf => Tree node leaf) => Tree node leaf
Node = 
	fn Tree: (fn node: Value => fn leaf: Value => unknown) => 
	fn node: Value => 
	fn leaf: Value => 
	fn left: Tree node leaf -> 
	fn n: node -> 
	fn right: Tree node leaf -> 
	fn Node: (
		fn left: Tree node leaf => 
		fn n: node => 
		fn right: Tree node leaf => 
		Tree node leaf
	) -> 
	fn Leaf: (fn _: leaf => Tree node leaf) -> Node left n right
Leaf = 
	fn Tree: (fn node: Value => fn leaf: Value => unknown) => 
	fn node: Value => 
	fn leaf: Value => 
	fn _leaf: leaf -> 
	fn Node: (
		fn left: Tree node leaf => 
		fn n: node => 
		fn right: Tree node leaf => 
		Tree node leaf
	) -> 
	fn Leaf: (fn _: leaf => Tree node leaf) -> Leaf leaf
```

```
bool = fn a: Type => fn x: a => fn y: a => a
true = fn a: Type -> fn x: a -> fn y: a -> x
false = fn a: Type -> fn x: a -> fn y: a -> y

eq = fn a: Type -> fn x: a -> fn y: a -> fn ctx: (fn z: a => Type) => fn w: ctx x => ctx y

refl: fn a: Type -> fn x: a -> eq a x x
refl = fn a: Type -> fn x: a -> fn ctx: (fn z: a => Type) -> fn w: ctx x -> w

sym: fn a: Type -> fn x: a -> fn y: a -> fn is_eq: eq a x y => eq a y x
sym = fn a: Type -> fn x: a -> fn y: a -> fn is_eq: eq a x y -> fn ctx: (fn z: a => Type) -> is_eq (fn z: a -> fn w: ctx z => ctx x) (refl ctx)

trans = fn a: Type -> fn x: a -> fn y: a -> fn z: a -> fn xy_is_eq: eq a x y -> fn yz_is_eq: eq a y z -> fn ctx: (fn z: a => Type) -> fn w: ctx x -> yz_is_eq ctx (xy_is_eq ctx w)

not = fn a: Type -> fn x: a => id

isEq: fn x: nat => fn y: nat => bool Type (eq nat x y) (not (eq nat x y)) = fn x: nat -> fn y: nat -> if x - y = 0 then refl x y else _

eq nat x y = fn ctx: (fn z: nat => Type) => fn w: ctx x => ctx y

```