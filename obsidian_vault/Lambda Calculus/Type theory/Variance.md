There are four types of variance:
1. Covariance - `f a <= f b` if `a <= b`. For example `f x = int -> x`
2. Contravariance - `f b <= f a` if `a <= b`. For example `f x = x -> int` or `f x = not x`
3. Invariance - `f a` and `f b` are unrelated for any unequal `a` and `b`. For example `f x = x -> x`
4. Bivariance - `f a === f b` if `a <= b`. For example `f _ = unknown`

https://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science)

Variance can be used to "shortcut" subtyping checks, by not forcing to compute `f a` first, and compare just arguments.
They affect set-theoretic types by allowing to distribute them out of call `f a`. In fact that can be used as an alternative definition for variance types, since intuition mostly comes from set interpretation of types:
1. Covariance - `f a <= f b` if `f a and f b = f (a and b)` or `f a or f b = f (a or b)`
2. Contravariance - `f b <= f a` if `f a and f b = f (a or b)` or `f a or f b = f (a and b)`
3. Invariance - `f a` and `f b` are unrelated for any unequal `a` and `b`. For example `f x = x -> x`
4. Bivariance - covariant and contravariant, `f a === f b` if `a <= b`. For example `f _ = unknown`