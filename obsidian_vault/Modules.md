Package consists of scripts, modules and a list of dependency packages.
Dependency list is passed to compiler as a path to file, that contains mapping from dependency name to actual sources location on the machine that compiles package. 
if compiler is passed a script, it is compiled into self-contained executable. Contains original script as an entry point, and all static dependencies of that script.
If compiler is passed a module, it is compiled into reusable library, that can be imported statically or dynamically to dependant modules or scripts. Contains original module, and all static dependencies of that module.
Dynamically imported modules and scripts are emitted as separate binaries, that are expected to be in the same location as dependant's file, unless specified otherwise during compilation.

Module and script compilation stages are separate commands in the compiler, so that outside manager could cache results
Cache entries are updated if stage inputs hash does not match cached hash.

Interpreter's behavior is the same, except that all imports are interpreted only once they occur during execution.

Foreign modules and scripts represent the code written in other languages.

Every pre-built module/script contains:
1. the binary source
2. call translator
3. module's interface
4. symbol mapping from interface to binary

import resolution:
1. If string is a relative path - import file relative to the source file
2. If string is absolute path - resolve as if it starts from project's root directory
3. If path refers to a module file - load as a module, 
4. If path refers to a script file - load as a script, 
5. If path refers to any other type of file - load as a binary array.
6. Otherwise resolve string as an external dependency using some kind of a table.
7. Resolve rest of the path as relative to dependency's package.

runtime binary import:
1. read symbol mapping
2. get function pointer
3. during call jump to call translator passing the functions pointer and other args
4. load module into memory or smthing
5. during compilation read module's interface and resolve any calls to symbols from it

[modules stuff](https://thunderseethe.dev/posts/whats-in-a-module/)