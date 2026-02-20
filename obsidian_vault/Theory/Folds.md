https://maartenfokkinga.github.io/utwente/mmf91m.pdf?utm_source=chatgpt.com

https://www.cs.ox.ac.uk/people/nicolas.wu/papers/URS.pdf?utm_source=chatgpt.com

https://people.cs.nott.ac.uk/pszgmh/bananas.pdf?utm_source=chatgpt.com

https://en.wikipedia.org/wiki/Bird%E2%80%93Meertens_formalism

https://yangzhixuan.github.io/pdf/fantastic-morphisms.pdf?utm_source=chatgpt.com

We can define a * op similar to &, that would construct "associative template" for the combination
https://homepages.inf.ed.ac.uk/slindley/papers/talking-bananas.pdf?utm_source=chatgpt.com

https://ravichugh.gitbooks.io/a-quarter-of-haskell/content/list-comprehensions/?utm_source=chatgpt.com

Structured recursion - a recursive function induced by a recursive function. Basically encapsulates iteration over arbitrary recursive structures

`for x in y with acc { newacc }`
Uses iteration protocol of the form `next() -> (v, children)`

`fold node in tree with acc { acc + recurse child }`
A more generic for loop with arbitrary recursion. Uses traversion protocol of the form `traverse(child) -> node`

We can derive duals to these constructs - generators and unfolds.
Generators:
```
gen f x {
	yield x
	f x+1
}
```
Unfolds:
```
unfold f x {
	yield (f x+1, f x+2)
}
```

Associativity - organize tree shaped map-reduce.
Commutativity - compute in parallel all the values, reduce linearly.
Distributivity - duplication/grouping 
Idempotence - short circuit computation once found identity value

These all assume a particular grouping strategy. Is there a variant that allows explicitly defining arbitrary grouping strategy?

https://chatgpt.com/c/69492f94-9a50-8328-82de-7719e0739d59

https://hackage.haskell.org/package/pipes
https://thunderseethe.dev/posts/in-search-of-the-perfect-fold/