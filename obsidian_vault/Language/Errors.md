Errors can be recoverable and unrecoverable. That division depends on the context in which we consider the execution.
For example "segfault" can be considered unrecoverable inside program runtime, but is recoverable on OS level.
"Stack overflow" is recoverable outside of thread that failed.
Most application level errors are recoverable from inside the program.

If some part of program cant recover from an error, usually it means shutdown of that part - termination of an operation, thread, or the entire program.

The program source code may specify points where it *can't* handle the error or points that *can* handle any error below the stack. 
The first can be implemented as `result` type with `?` operator that "unwraps" it, immediately returning error if it was an error variant. 
That usually covers errors that immediate user of the component could handle.
The second case is handle with `try-catch` constructs and usually not useful for "expected" errors, thus only used for unexpected errors such as failing assertions, which usually means immediate user won't be able to recover from such errors.

panics cannot be avoided, and will eventually become "catchable", so it is better to implement it right away properly.

https://www.reddit.com/r/ProgrammingLanguages/s/ICKPEWJdjN