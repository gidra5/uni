Available tools to model concurrent work:
`|` operator - "parallel"  values constructor. Together with function application allows to model `SIMD`, `MIMD`, `MISD` computations.
`yield` - to suspend current function. Will be resumed on next call and argument will be passed as value.
`channel` - allows synchronizing parallel values.
`async` - runs given function concurrently when called. equivalent of `go` operator in Go, but allows receiving return value with await, not only through channels.
`await` - await `async` function call result
`<- c` - receive from channel
`c <- x` - send to a channel