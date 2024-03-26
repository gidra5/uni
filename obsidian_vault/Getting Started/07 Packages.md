Package's file can be either a module or a script.
Script is a file with single expression. Imperative
Module is a file with multiple declarations.
`import "a"` - imports a source file
`import "a" with b` - passes b to the module during import

Modules compiled into libraries always, thus they can't really contain entry points.
Scripts compiled into executables always, whose source is the entry point.

Since modules are declarative, it allows more stuff to do.
For example all declarations can be considered simultaneous.
That allows us to not think about order of declarations, and we can easily use indirect recursion for example.
It also allows declaration of custom operators and injecting into default behaviours such as indexing.
