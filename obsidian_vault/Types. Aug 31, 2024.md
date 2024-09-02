as a closest to machine code IR
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

Subtyping relation `<:` is defined:
1. `a <: unknown`
1. `Value <: Type`
1. `a <: a`
3. `a and b <: a` and `a and b <: b`
4. `a, b1, b2, (fn x: a => b1) and (fn x: a => b2) < fn x: a -> (b1 and b2)`
5. `a, b1, b2, (fn x: b1 => a) and (fn x: b2 => a) < fn x: b1 or b2 -> a`
6. `a, b1, b2, a < b1, a < b2, a < b1 and b2`
7. 
```
a1, a2, b1, b2, 
a1 <: a2, b1 <: b2, 
(fn x: a2 => b1) <: (fn x: a1 => b2)
```
7. 
```
for all x, (fn x: a1 -> b1) x <: (fn x: a2 -> b2) x then 
(fn x: a1 -> b1) <: (fn x: a2 -> b2)
```

Basis of type system is Calculus of Constructions:

1. There is a *Value* which is **Type of propositions**.
2. There is a *Type* which is **Type of types**.
3. There are abstractions `fn y: f(x) -> g(y)`
4. There is a type of abstractions `fn y: f(x) => g(y)`
5. There are applications `x y`
6. `x: y` means *x is of type y*.
7. `f(x: t)` means *f with substitution x of type t*
8. `g(y)` in  `fn y: f(x) => g(y)` cannot reduce to `Type`

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
```

```
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
```

```
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
```

```
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

```
5. fn x -> fn y -> x y

a'
b'
y: b'
x: fn x: a' => b'

fn a': Type -> fn b': Type -> fn x: (fn x: a' -> b') -> fn y: 'a -> b' 

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

not = fn a: Type -> fn x: a => never
notnot_elim = fn a: Type -> fn ctx: (fn z: Type => Type) -> fn x: ctx (not not a) => a

proof: fn a: Type => eq Type (not not a) a = fn a: Type -> fn ctx: (fn z: Type => Type) -> fn w: ctx (not not a) -> refl Type a ctx (notnot_elim a ctx w)

isEq: fn x: nat => fn y: nat => bool Type (eq nat x y) (not (eq nat x y)) = fn x: nat -> fn y: nat -> if x - y = 0 then refl x y else id

eq nat x y = fn ctx: (fn z: nat => Type) => fn w: ctx x => ctx y


  let negate = pi "x" Star Star in
  
  Printf.printf "%s" (print (infer_type negate)) = Box
  
  Printf.printf "%s" (print (infer_type (pi "x" (pi "x" Star Star) Star))) = Box
  
  Printf.printf "%s" (print (infer_type (pi "x" Star (Var "x")))) = Star
  
  Printf.printf "%s" (print (infer_type (pi "a" Star (lam "x" (Var "a") (Var "x"))))) -
  Printf.printf "%s" (print (infer_type (pi "a" (lam "x" Star (Var "x")) Star))) -
  Printf.printf "%s" (print (infer_type (pi "x" (lam "x" Star Star) Star))) -
  Printf.printf "%s" (print (infer_type (pi "x" (lam "x" Star (Var "x")) Star))) -
  Printf.printf "%s" (print (infer_type (lam "x" (lam "x" Star (Var "x")) Star))) -
  Printf.printf "%s" (print (eval (lam "x" (lam "x" Star (Var "x")) Star))) +
  Printf.printf "%s" (print (eval (pi "x" (lam "x" Star (Var "x")) Star))) +
  Printf.printf "%s" (print (eval (pi "x" (lam "x" Star Star) Star))) +
  Printf.printf "%s" (print (infer_type (lam "x" Box (Var "x")))) -
  Printf.printf "%s" (print (infer_type (lam "x" Box Star))) -
  Printf.printf "%s" (print (infer_type (lam "x" Box Box))) -
  Printf.printf "%s" (print (infer_type (lam "x" Star Box))) -
  Printf.printf "%s" (print (infer_type (lam "x" Star Star))) -
  Printf.printf "%s" (print (infer_type (lam "x" Star (Var "x")))) -
  Printf.printf "%s" (print (infer_type (pi "x" Box (Var "x")))) -
  Printf.printf "%s" (print (infer_type (pi "x" Box Star))) -
  Printf.printf "%s" (print (infer_type (pi "x" Box Box))) -
  Printf.printf "%s" (print (infer_type (pi "x" Star (Var "x")))) = Star
  Printf.printf "%s" (print (infer_type (pi "x" Star Star))) = Star
  Printf.printf "%s" (print (infer_type (pi "x" Star Box))) -

  lambdas in type annotation position are not allowed when inferring type
  Box cannot appear in pi lambda, lhs\rhs of appl terms when inferring type - cannot appear in term that is subject to type inference
  Star\Box cannot appear in lambda term that is subject to type inference
```

https://inria.hal.science/file/index/docid/76261/filename/RR-0296.pdf

https://coq.github.io/doc/V8.11.1/refman/language/cic.html

http://pauillac.inria.fr/~huet/PUBLIC/typtyp.pdf

Индуктивные типы это:
Объявление номинального типа без определения
Объявление "конструкторов" - имена которые так же не имеют тела, но определены как имеющие/использующие тип, определенный ранее

Так они не имеют определений, они по сути используются как tuples

Любое значение имеющее номинальный тип считается нормальной формой этого значения


![[chrome_rmkcBFAW1x_1693548108.png]]
Consider a derivation tree of some judgement `Γ  M : T` in the system ICC above. We shall associate with it the following information. First we have a finite set of formal variables `{x1, ..., xn}`. We think of variable `xi` as ranging over integers. Next we have a set of constraints on the formal variables, which are inequalities in terms of a partial ordering ``<``. More precisely, we have constraints of the form `xi < xj` , of the form `xi ≤ xj` , and of the form `xi = xj` . Think of these constraints `{C1, ..., Cp}` as expressing the arithmetic formula `∃x1...∃xn · C1 ∧ ... ∧ Cp`. Finally we associate with every occurrence of the constant `Type` in the judgement Γ `M : T` one of these formal variables. Several occurrences may be mapped on the same variable. In the following, we indicate `Type_i` to show that the corresponding occurrence of `Type` is mapped to the formal variable `xi` . 
We now show by induction on the derivation of the judgement how to maintain and update this information. First, it is understood that the set of formal variables always increases along a derivation, and that “residual” occurrences of `Type` keep their mapping `Type_i` . By residual we mean the standard notion: occurrences inside the formulas matching the meta-variables `M, N, P, Q, R, Γ` in the premisses of rules have their residuals in the corresponding occurrences in the conclusion of the rule. Also the residuals of `N` in `[N/x]M` are the substituted occurrences, as usual. Finally, the residuals along λ-reductions are defined in the usual way. 
Now, we consider each inference rule in turn. In this analysis, we assume that the rules are used in proof-checking fashion. We shall explain later how the consistency check may be computed in proof-synthesis mode. First, the rules for environment formation just preserve constraints by residuals. Next are type inference rules. 
1. If rule `(TI1)` is used, we increment `n` by one, we add a new formal variable `xn`, we derive `Γ  -> Prop : Type_n`, and we add the constraint `0 ≤ xn`. 
2. If rule `(TI2)` is used, we increment `n` by two, we add two new formal variable `xn−1` and `xn`, we derive `Γ -> Type_n−1 : Type_n`, and we add the constraint `xn−1 < xn`. 
3. If rule `(TI3)` is used, we preserve the constraints by residuals, except in case `x` is bound to `Type_i` in context `Γ`, in which case we increment `n` by one, we add a new formal variable `xn`, we derive `Γ x : Type_n`, and we add the constraint `xi ≤ xn`. 
4. If one of the rules `(TI4)` or `(TI5)` is used, we just preserve constraints by residuals. 
5. If rule `(TI6)` is used, we assume that the derivation of the first premiss `Γ  M : T ypei` gave a set of constraints which was used (with proper residuals in `M` and `Γ`) to derive the second premiss `Γ, x : M, N : Type_j` with the current set of constraints. We then increment `n` by one, we add a new formal variable `xn`, we derive `Γ  (x : M)N : Type_n` and we add the two constraints `xi ≤ xn` and `xj ≤ xn`. 
6. If rule `(TI7)` is used, we assume that the derivation of the first premiss `Γ  M : Prop` gave a set of constraints which was used (with proper residuals in `M` and `Γ`) to derive the second premiss `Γ, x : M , N : Type_i` with the current set of constraints. We then increment `n` by one, we add a new formal variable `xn`, we derive `Γ  (x : M)N : Type_n` and we add the constraint `xi ≤ xn`. 
7. If rule `(TI8)` is used, we assume that the derivation of the first premiss `Γ  M : (x : Q)P` gave a set of constraints which was used (with proper residuals in `Γ`) to derive the second premiss `Γ  N : R` with the current set of constraints. We then assume (without loss of generality by the Church-Rosser property) that the test `Q ≡ R` is effected by reducing `Q` and `R` to identical forms. In these identical forms, every corresponding occurrence of say `Type_i in Q` and `Type_j in R` will generate a constraint `xi = xj` . Finally, we derive `Γ  (M N) : [N/x]P` with proper residuals. There is a special case when `P` is `Type_i` , in which case we increment `n` by one, we add a new formal variable `xn`, we derive `Γ  (M N) : Type_n`, and we add the constraint `xi ≤ xn`. 
8. Finally, if the rule `(TE)` is used, we keep the constraints by residual, except when `P` is `Type_i` , in which case we increment `n` by one, we add a new formal variable `xn`, we derive `Γ  M : Type_n`, and we add the constraint `xi ≤ xn`.

![[chrome_MDKK1pYBB9_1693548495.png]]

https://ziglearn.org/chapter-1/#comptime

Adjust inference rules:
1. Term `Type[n]` is of type `Type[n+1]`.
2. Term `fn x: A -> B` is of type `fn x: A -> typeof B[x: A]`.
3. In given context `C`, term `M: fn x: A -> B`, `N: A`, `M N` is of type `B[x=N]`.
4. In given context `C`, `x: A` in `C`, `x` is of type `A`.
5. In given context `C`, `Type: Type` is equivalent to `Type[n]: Type[n+1]` for some `n`.
6. 
They are allowed to be used in reverse to infer type of context that is required for a given term.

Reverse rules to infer context: 
1. Given term `x` infers context `a': Type, x: a'`
2. Given term `x y` infers context `x: fn x: a' => b', y: a'`
3. Given term `fn x -> B` infers context `a: Type, (fn x -> B): fn x: a -> typeof B[x: a]`
3. Given term `fn x: A -> B` infers context `a: Type, (fn x: A -> B): fn x: a and A -> typeof B[x: a and A]`
4. Given term `x: y` infers context `y: Type`
5. Given context `(fn x: t1 -> f(x)): fn x: t1 => g(x)` infers context `f(x: t1): g(x)`
6. Given context `(fn x: t1 => f(x)): t2` infers context `f(x: t1): t2`
7. Given context `x: a, x: b` infers context `x: a and b`
8. Given context `x: (fn x: t1 => f(x)) and (fn x: t2 => f(x))` infers context `x: (fn x: t1 or t2 => f(x))`
9. Given context `x: (fn x: t1 => f(x)) and (fn x: t2 => g(x))` infers context `bool: (fn a: Value => fn x: a => fn y: a => a), a': bool, x: (fn x: a' unknown t1 t2 => a' unknown f(x) g(x))`
10. Given context `x: a, a: Type[n], a: b, b: Type` infers context `b: Type[n+1]`
11. Given context `x: a, a: Type` infers context `a: Type[0]`

```
bool_t = fn a: Type -> fn x: a -> fn y: a -> a

true: bool_t = fn a, x, y -> x
false: bool_t = fn a, x, y -> y

bool2_t = fn a: Type -> fn b: Type -> fn c: Type -> fn x: a -> fn y: b -> c
bool2_true_t = fn a: Type -> fn b: Type -> bool2_t a b a
bool2_false_t = fn a: Type -> fn b: Type -> bool2_t a b b

true2: bool2_true_t = fn a, b, x, y -> x
false2: bool2_false_t = fn a, b, x, y -> y

tuple_t = fn a: Type -> fn b: Type -> fn c: Type -> fn match: bool2_t a b c -> c
tuple_c = fn a: Type -> fn b: Type -> fn x: a -> fn y: b -> fn c: Type -> tuple_t a b c
tuple: tuple_c = fn a, b, x, y, c -> fn match -> match x y

getter_t = fn a: Type -> fn b: Type -> fn c: Type -> fn bool: bool2_t a b c -> fn tuple: tuple_t a b -> tuple c (bool a b)

get = fn a: Type -> fn b: Type -> fn c: Type -> fn bool: bool2_t a b c -> fn tuple: tuple_t a b -> tuple c (bool a b)

first = fn a: Type -> fn b: Type -> fn tuple: tuple_t a b -> tuple a (true2 a b)
second = fn a: Type -> fn b: Type -> fn tuple: tuple_t a b -> tuple b (false2 a b)



(fix fn tuple_n -> fn n -> n (fn pred -> fn x -> tuple_n pred x) ()) 2 =
(fix fn tuple_n -> 2 (fn pred -> fn x -> tuple_n pred x) ()) =
(fix fn tuple_n -> fn x -> tuple_n 1 x) =
fn x -> (fix fn tuple_n -> fn n -> n (fn pred -> fn x -> tuple_n pred x) ()) 1 x =
fn x -> (fix fn tuple_n -> 1 (fn pred -> fn x -> tuple_n pred x) ()) x =
fn x -> (fix fn tuple_n -> fn x2 -> tuple_n 0 x2) x =
fn x -> fn x2 -> (fix fn tuple_n -> fn n -> n (fn pred -> fn x -> tuple_n pred x) ()) 0 x2 x =
fn x -> fn x2 -> (fix fn tuple_n -> 0 (fn pred -> fn x -> tuple_n pred x) ()) x2 x =
fn x -> fn x2 -> () x2 x =
fn x -> fn x2 -> (fn x -> x) x2 x =
fn x -> fn x2 -> x2 x =
	
id = 
fn id_c -> id_c = 
fn id_c -> fn x -> id_c x

fn id -> fn a -> fn x -> id x a
fn t_c -> fn b -> fn a -> fn x -> t_c a x b = 
fn b -> fn a -> fn x -> (fn a -> fn x -> id x a) a x b = 

```

```
tuple_n = fn N -> 
	letrec construct_tuple = fn N -> fn acc -> 
		if iszero N then acc 
		else construct_tuple 
			(pred N) 
			(fn x -> fn y -> x (y acc)) 
	in construct_tuple N (fn x -> x) 
end
```

Nominal types useful to describe "measures" - they are described by the same underlying type (`number`), but carry different semantics (`cm != mm`). By making them nominal, we can then define particular behavior to them, like conversion between measures (`1 cm => 10 mm`).
That may as well be used for library developers, that may use the same terminology as others (`Request` in `http` module and `Request` in `websocket` module mean different things and should not be mixed, probably, even if they happen to have the same structure), but mean different thing by it. It can be views as means to distinguish between synonyms and ambiguous values

Set theoretic types: https://www.irif.fr/~gc/papers/set-theoretic-types-2022.pdf 
Types that allow set-theoretic operations to be performed with them, such as `union`, `intersetion`, `negation` of some types

Gradual typing explained: https://elixir-lang.org/blog/2023/09/20/strong-arrows-gradual-typing/ 
We introduce type `any` which means we can't know type of its value until runtime, thus requiring runtime checks to verify its type, unless we can statically analyze how it is used and avoid checks

[dependant types impl](https://www.andres-loeh.de/LambdaPi/LambdaPi.pdf)