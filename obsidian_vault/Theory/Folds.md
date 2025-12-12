https://maartenfokkinga.github.io/utwente/mmf91m.pdf?utm_source=chatgpt.com

https://www.cs.ox.ac.uk/people/nicolas.wu/papers/URS.pdf?utm_source=chatgpt.com

https://people.cs.nott.ac.uk/pszgmh/bananas.pdf?utm_source=chatgpt.com

https://en.wikipedia.org/wiki/Bird%E2%80%93Meertens_formalism

https://yangzhixuan.github.io/pdf/fantastic-morphisms.pdf?utm_source=chatgpt.com

We can define a * op similar to &, that would construct "associative template" for the combination
https://homepages.inf.ed.ac.uk/slindley/papers/talking-bananas.pdf?utm_source=chatgpt.com

Structured recursion - a recursive function induced by a recursive function. Basically encapsulates iteration over arbitrary recursive structures

`for x in y with acc { newacc }`
Uses iteration protocol of the form `next() -> (v, children)`

`traverse node in tree with acc { acc + recurse child }`
A more generic for loop with arbitrary recursion. Uses traversion protocol of the form `traverse(child) -> node`