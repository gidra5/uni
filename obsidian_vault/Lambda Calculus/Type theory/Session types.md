types that describe sequence of interactions between some processes.
useful to exactly type dynamic streams/channels/iterators.
the usual syntax is something like `!send.?receive.!another.end`, which means - the channel expects to be sent value of `send` type, then will receive value of `receive` type, then expects another value of type `another` this time, after which the channel will be closed.

Besides sequencing, there is also a `&` operator that represents select operation on multiple channels:
```
c1: ?t1.rest.end
c2: ?t2.rest.end
c1 & c2: ?t1.rest.end & ?t2.rest.end
x: t1 | t2 = <- c1 & c2 // c1: rest.end, c2: rest.end
```

they can be binary or multiparty - meaning communication between two or many processes

Can be embedded in effects, and vice versa.

https://blog.sigplan.org/2024/08/12/soundly-handling-linearity/
https://github.com/Munksgaard/session-types
https://www.doc.ic.ac.uk/~dorchard/publ/popl16-orchard-yoshida.pdf
https://kar.kent.ac.uk/61623/1/effects-revisited.pdf

