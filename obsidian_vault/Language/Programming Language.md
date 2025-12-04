The language consists of a [[Parsing/Syntax|syntax]] and an execution model.
Execution model is implemented by [[Compilation|compiler]] or interpreter and described by semantics.

The language's projects are based on modules and scripts.

Modules define a set of imports, dependencies, external items, exported items.
It may also define private items to be used inside the module.

Scripts are "runnable" modules. As if you created module with one declaration that is the "main" function.
Dually, modules are scripts that result in a record of exported entries.

Project may be a library, in which case it must specify entry _module_ file, which exposes library's interface.
Project may be an executable, in which case it must specify entry _script_ file, which defines executable's commands.
Project also specifies what are dependency libraries, their version and where to get it (link to the repository or a library database).

https://vekatze.github.io/neut/overview.html
https://github.com/capy-language/capy/tree/master
https://flix.dev/
https://www.reddit.com/r/ProgrammingLanguages/comments/1frz2wl/can_you_teach_me_some_novel_concepts/
http://neilmitchell.blogspot.com/2020/04/writing-fast-interpreter.html
https://github.com/zserge/tinylangs
https://www.reddit.com/r/ProgrammingLanguages/s/XrbjFZrWqa
https://www.reddit.com/r/ProgrammingLanguages/comments/1fyxu4n/whats_the_coolest_minor_feature_in_your_language/
https://arxiv.org/pdf/2108.11155
https://plasmalang.org/about.html
https://effekt-lang.org/quickstart.html


https://cs.lmu.edu/~ray/notes/languagedesignnotes/

1. computation abstraction
2. macro abstraction
3. communication abstraction
4. type abstraction