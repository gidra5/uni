types that describe sequence of interactions between some processes.
useful to exactly type dynamic streams/channels/iterators.
the usual syntax is something like `!send.?receive.!another.end`, which means - the channel expects to be sent value of `send` type, then will receive value of `receive` type, then expects another value of type `another` this time, after which the channel will be closed.

they can be binary or multiparty - meaning communication between two or many processes

https://blog.sigplan.org/2024/08/12/soundly-handling-linearity/