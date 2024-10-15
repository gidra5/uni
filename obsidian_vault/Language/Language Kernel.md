```
e := inject e { e }
   | handle symbol e fn x { e }
   | fn x { e }
   | e e
   | ch x { e }
   | e "|" e
   | e + e
   | e.send e fn { e }
   | e.receive fn x { e }
```

```

inject s: fn cont, v { e1 } { handle s e2 fn x { e3 } } -> 
	(fn v, k { e1 }) e2 fn x { inject s: fn cont, v { e1 } { e3 } }
inject e1 { e2 | e3 } -> inject e1 { e2 } | inject e1 { e3 }
inject [return]: fn v { e1 } { e2 } -> fn v { e1 } e2
inject s1: e1 { handle s2 e2 fn x { e3 } } -> 
	handle s2 e2 fn x { inject s1: e1 { e3 } } 
e1 -> e2, inject e { e1 } -> inject e { e2 }


   | handle symbol e
   | fn x { e }
   | e e
   | ch x { e }
   | e "|" e
   | e + e
   | e.send e fn { e }
   | e.receive fn x { e }
```