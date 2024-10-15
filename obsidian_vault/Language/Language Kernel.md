```
f := fn x { e }
e := inject symbol: f { e }
   | handle symbol e f
   | f
   | e e
   | ch x { e }
   | e "|" e
   | e + e
   | e.send e f
   | e.receive f
   | {}
```

```
inject s: fn cont, v { e1 } { handle s e2 fn x { e3 } } -> 
	(fn v, k { e1 }) e2 fn x { inject s: fn cont, v { e1 } { e3 } }
inject e1 { e2 | e3 } -> inject e1 { e2 } | inject e1 { e3 }
inject [return]: fn v { e1 } { e2 } -> fn v { e1 } e2
inject s1: e1 { handle s2 e2 fn x { e3 } } -> 
	handle s2 e2 fn x { inject s1: e1 { e3 } }
(handle s e1 fn x { e2 }) e3 -> (handle s e1 fn x { e2 e3 })
fn x { e1 } e2 -> e2[x=e1]

(e1 + c.send e2 fn { e3 }) | (c.receive fn x { e4 } + e5) ->
	e3 | e4[x=e2]
e + {} -> e
e | {} -> e
{} + e -> e
{} | e -> e

e1 -> e2, inject e { e1 } -> inject e { e2 }
		, ch x { e1 } -> ch x { e2 }
		, e | e1 -> e | e2
		, e1 | e -> e2 | e
		, e + e1 -> e + e2
		, e1 + e -> e2 + e
		, e1 e -> e2 e
		, e e1 -> e e2
```