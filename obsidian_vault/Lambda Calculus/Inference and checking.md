Type inference is done in two directions:
1. Infer type of all variables that are expected to exist for a given expression to be valid. That basically infers types from usage.
2. Given a set of variables with defined types for each of them, assert that they fit into expected context of every expression. That checks that if variables are given annotations, they are used correctly, if not, then its checked against the inferred type.

Inference from usage gets a lower bound on what the value can be. 
Inference from arguments gets upper bound on what is even passed there.
They should always have that subtyping relation.

That means we do two passes, one for each direction. 
Rules for inference and type checking may be considered mirror reflections of each other.

https://davidchristiansen.dk/tutorials/bidirectional.pdf

Inference is based on typing rules defined by type system.
The easiest to implement rules are syntax-driven, that is, types can be inferred only based on the syntactic structure of the program.

```
x x

=>
x = a' -> b'
x <: a'
(x x) = b'

=>
x = a' and (a' -> b')
(x x) = b'

---

fn f -> (fn x -> x x) (fn x -> f (x x))

=>
(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x -> x x) (fn x -> f (x x))) = b'

=>
(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'

(fn x1 -> x1 x1) = c' -> d'
(fn x2 -> f (x2 x2)) <: c'
(x1 x1) <: d'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = d'

=> 
(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'

(fn x1 -> x1 x1) = c' -> d'
(fn x2 -> f (x2 x2)) <: c'
(x1 x1) <: d'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = d'

(fn x2 -> f (x2 x2)) = e' -> f'
(f (x2 x2)) <: f'

x1 = g' -> h'
x1 <: g'
(x1 x1) = h'

=> 
(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'

(fn x1 -> x1 x1) = c' -> d'
(fn x2 -> f (x2 x2)) <: c'
(x1 x1) <: d'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = d'

(fn x2 -> f (x2 x2)) = e' -> f'
(f (x2 x2)) <: f'

x1 = g' -> h'
x1 <: g'
(x1 x1) = h'

f = a1' -> b1'
(f (x2 x2)) = b1'
(x2 x2) <: a1'

=> 
(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'

(fn x1 -> x1 x1) = c' -> d'
(fn x2 -> f (x2 x2)) <: c'
(x1 x1) <: d'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = d'

(fn x2 -> f (x2 x2)) = e' -> f'
(f (x2 x2)) <: f'

x1 = g' -> h'
x1 <: g'
(x1 x1) = h'

f = a1' -> b1'
(f (x2 x2)) = b1'
(x2 x2) <: a1'

x2 = a2' -> b2'
x2 <: a2'
(x2 x2) = b2'

==>

(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'

((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = d'

(fn x1 -> x1 x1) = c' -> d'

(fn x2 -> f (x2 x2)) <: c'
(fn x2 -> f (x2 x2)) = e' -> f'

(x1 x1) <: d'
(x1 x1) = h'

(f (x2 x2)) <: f'
(f (x2 x2)) = b1'

x1 = g' -> h'
x1 <: g'

f = a1' -> b1'

(x2 x2) <: a1'
(x2 x2) = b2'

x2 = a2' -> b2'
x2 <: a2'

==>

(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'

((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'
b' = d'

(fn x1 -> x1 x1) = c' -> d'

(fn x2 -> f (x2 x2)) <: c'
(fn x2 -> f (x2 x2)) = e' -> f'

(x1 x1) <: d'
(x1 x1) = h'

(f (x2 x2)) <: f'
(f (x2 x2)) = b1'

x1 = g' -> h'
x1 <: g'

f = a1' -> b1'

(x2 x2) <: a1'
(x2 x2) = b2'

x2 = a2' -> b2'
x2 <: a2'

=>

(fn f -> (fn x -> x x) (fn x -> f (x x))) = a' -> b'
((fn x1 -> x1 x1) (fn x2 -> f (x2 x2))) = b'
(fn x1 -> x1 x1) = c' -> b'
(fn x2 -> f (x2 x2)) = c' and (e' -> f')
(x1 x1) = b' and h'
(f (x2 x2)) = f' and b1'
x1 = g' and (g' -> h')
f = a1' -> b1'
(x2 x2) = a1' and b2'
x2 = a2' and (a2' -> b2')

```