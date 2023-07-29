The language consists of [[Syntax|syntax]], [[Analysis|analysis]] and [[Compilation|compiler]]/[[Interpretation|interpreter]].

The language's projects are based on modules and scripts.

Modules define a set of imports, dependencies, external items, exported items.
It may also define private items to be used inside the module.

Scripts are "runnable" modules. As if you created module with one declaration that is the "main" function.

Project may be a library, in which case it must specify entry _module_ file, which exposes library's interface.
Project may be an executable, in which case it must specify entry _script_ file, which defines executable's commands.
Project also specifies what are dependency libraries, their version and where to get it (link to the repository or a library database).
