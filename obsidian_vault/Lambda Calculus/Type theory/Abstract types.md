
Abstract types are those that suppose there exists some value with given interface, without needing to know actual type.

Suppose we have an interfaces like in Java:
```
interface Stack<T> {
  void push(T item);
  T pop();
}
```

Нашел [статью](https://theory.stanford.edu/~jcm/papers/mitch-plotkin-88.pdf) в ссылках википедии, в которой упоминают очень интересный результат, связанный с интерфейсами. А точнее что при некоторых условиях они могут привести к программам которые не завершаются при любом инпуте. Без рекурсии! Детали этой проблемы не описывают, потому что сложна, так что пока хз как это возможно. Лично меня это дерьмо удивило, потому что я считал что любая программа которая не завершается так или иначе сводится к бесконечной рекурсии\циклу гденить в реализации. И тут оказывается интерфейсы делают это не единственным вариантом.
Как я понял проблема сводится к тому что если метод интерфейса уйдет за пределы скоупа, где интерфейс обьявлен, то гг. Это может кажется надуманной проблемой, тк обычно интерфейсы и так обьявляются только в глобальном скоупе, и makes sense ограничить куда может "сбежать" метод в ином случае, а значит но проблем, но знать что это не просто потому шо так удобно сделали тоже полезно. Мб получится разобраться какой пример они рассматривали, что может привести к такому.

```
m := {
  interface I {
    a: I -> I
  }
  x: I := (
    a: fn i -> ...
  )
  x.a
}
```

abstract classes and interfaces supposed to correspond to existential types, which in turn correspond to logical existentials.

For logical existentials like `there exist integer n such that n = 3` to be true we must provide a witness together with a proof that witness actually satisfies the premise. In case of `there exist integer n such that n = 3` it is a number 3 substituted for n and a proof it equals 3.
these propositions can be expressed as existential type `∃n: int.n=3` with an inhabitat 3. Since inhabitats of a type are interpreted to be witnesses, 3 has multiple types - `int`, `∃n: int.n=3`, `∃n: int.n%3=0`, etc, corresponding to every existential it satisfies with some proof.
These existential types in turn can be interpreted as interfaces, and their inhabitats as values that implement that interface.
Thus stuff like `x: ∃a.i(a)` is interpreted as "variable `x` has some type `a` that implements an interface `i`"
Another way to interpret `∃a: int.i(a)` is "tagged union of all implementee of interface `i`, with tag being of type int". So if every value of `int` would implement its own interface `i`, that type will represent union of all of them.
Yet another way to interpret `∃a: int.i(a)` is a "dependant pair" - a tuple type, where type of a second element depends on exact value of the first. So in values `(1, x)` and `(2, x)`, that are elements of `∃a: int.i(a)`, type of `x` may be different in each case.
if the implementation does not actually depend on exact value that "implements" it, then its equivalent to regular tuple type, `∃a: int.b === (int, b)`
All these are equivalent, but induce different handling in context of PLs.

`∃t.N`, `N` is any type with an inhabitat `n`. Any type will satisfy this existential, since it does not depend on `t`, so they don't need to do anything to adhere. The existance of `n` already proves that any type satisfies it. That can be interpreted as an interface with all methods having default implementations, thus any type given will suffice.
Since it itself is a type, we could derive `(∃t.N, n): ∃t.N`, which appears to be equivalent to `type: type` axiom.

https://theory.stanford.edu/~jcm/papers/mitch-plotkin-88.pdf
[strong existentials are inconsistent](https://ecommons.cornell.edu/server/api/core/bitstreams/ba4fbbb2-13ae-4fe9-ad63-10d332170c9f/content)
[girard's paradox coc](https://www.cse.chalmers.se/~coquand/girard.pdf)
https://lawrencecpaulson.github.io/papers/ML-Int-TT.pdf