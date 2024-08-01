Package's file can be either a module or a script.
Script is a file with sequence of statements. Imperative
Module is a file with multiple declarations.
`import "a"` - imports a source file
`import "a" with b` - passes b to the module during import
`import "a" as { x, y }` - imports a source file and binds to x, y
`import "a" as { x, y } with b` - passes b to the module during import and binds to x, y

Modules compiled into libraries always, thus they can't really contain entry points.
Scripts compiled into executables always, whose source is the entry point.

Since modules are declarative, it allows more stuff to do.
For example all declarations can be considered simultaneous.
That allows us to not think about order of declarations, and we can easily use indirect recursion for example.
It also allows declaration of custom operators.

import string format allows importing any files:
1. relative to current file
2. relative to root of project
3. relative to root of dependency

dependencies can either be pulled locally and referred by name exactly, or with a git repository link

