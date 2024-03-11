Available tools to model concurrent work:
`|` operator - "parallel"  values constructor. Together with function application allows to model `SIMD`, `MIMD`, `MISD` computations.
`yield` - to suspend current function. Will be resumed on next call and argument will be passed as value.
`channel` - allows synchronizing parallel values.
`async` - runs given function concurrently when called. equivalent of `go` operator in Go, but allows receiving return value with await, not only through channels.
`await` - await `async` function call result
`<- c` - receive from channel
`c <- x` - send to a channel
`<-? c` - peek a channel state without blocking, is it emply, closed, or pending.
`c ?<- x` - try pushing value into channel. will return status instead of blocking if noone ready to receive.
`select c1 c2 c3` - wait for receiving of either of channels.