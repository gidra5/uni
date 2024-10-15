```
e := inject e { e }
   | handle symbol e
   | fn x { e }
   | e e
   | ch x { e }
   | e "|" e
   | e.send e fn { e }
   | e.receive fn x { e }
```