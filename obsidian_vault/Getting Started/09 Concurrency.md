Lets get to more advanced stuff 

Available tools to model concurrent work:
`a | b` operator - "parallel composition" of `a` and `b`. Together with function application allows to model `SIMD`, `MIMD`, `MISD` computations.
`yield` - to suspend current function. Will be resumed on next call and argument will be passed as value in place of yield.
`channel` - allows synchronizing parallel values.
`async` - runs given function concurrently when called. equivalent of `go` operator in Go, but allows receiving return value with await, not only through channels.
`await` - await `async` function call result
`<- c` - receive from channel, blocks until value is available
`c <- x` - send to a channel, blocks until some receiver is ready to accept
`<-? c` - peek a channel state without blocking, is it emply, closed, or pending.
`c ?<- x` - try pushing value into channel. will return status instead of blocking if noone ready to receive.
`select (c1, c2, c3)` - wait for receiving of either of channels.
`all (a | b)` - wait until all threads settle on some value. If any one throws, the whole expression rethrows that error.
`some (a | b)` - wait until some thread settles on final value. if all threads fail, the whole expression will collect the errors and rethrow an array of those errors.

These can be used anywhere in program