Package consists of package entries. Package entry is a script, module or a dependency package.
Package entry point is a package entry against which compiler is run.
Dependency list is passed to compiler as a path to file, that contains mapping from dependency name to actual sources location on the machine that compiles package. 
if compiler is passed a script, it is compiled into self-contained executable. Contains original script as an entry point, and all static dependencies of that script.
If compiler is passed a module, it is compiled into reusable library, that can be imported statically or dynamically to dependent modules or scripts. Contains original module, and all static dependencies of that module.
Dynamically imported modules and scripts are emitted as separate binaries, that are expected to be in the same location as dependent's file, unless specified otherwise during compilation. Statically referenced modules from the dynamic one are either bundled in, or expect a reference to the location of the module, depending on whether these dependencies are only reachable through this module or not. If is, then we can safely bundle it into a dynamic library, if not, then it must be shared, and it may be already bundled elsewhere.

Module and script compilation stages are separate commands in the compiler, so that outside manager could cache results
Cache entries are updated if stage inputs hash does not match cached hash.

Interpreter's behavior is the same, except that all imports are interpreted only once they occur during execution.

Foreign package entries represent the code written in other languages. If it is dynamically imported, then it is interpreted as dynamically linked library, expected to be installed on the user machine.

Every pre-built package entry contains:
1. the binary source
2. call translator
3. package entry's interface
4. symbol mapping from interface to binary

import path resolution:
1. If string is a relative path - import file relative to the source file
2. If string is absolute path - resolve as if it starts from project's root directory
3. If path refers to a module file - load as a module, 
4. If path refers to a script file - load as a script, 
5. If path refers to any other type of file - load as a binary array.
6. Otherwise resolve string as an external dependency using some kind of a table.
7. Resolve rest of the path relative to dependency's package.
8. resulting path is memoized - if imported more than once use already evaluated/built module

package import resolution:
1. resolve import path and compile it into prebuilt package entry, recording its semver
2. embed import function
  1. for module: read symbols and return as a constant record of functions
  2. for script: return as a function that will execute script body
  3. return binary for any other files
3. if sync import:
  1. embed prebuilt package entry 
  2. replace import with reference to the record
4. if async import:
  1. save package entry as a separate binary
  2. embed package loader, or resolve its reference if already embedded
  3. add package entry path to package registry
  4. replace import with call to the package loader with registry index

package loader:
  1. Compare expected and available package entry versions - fail if incompatible
  2. load package entry into memory
  3. resolve pointer to a record within that package entry

interpreter import:
1. read source file
2. if script - return function that will execute it
3. if module - pass arguments and evaluate.

package entry bundling:
1. compile each entry
2. save as:
  1. separate files expected to be in some fixed folder relative to executable
  2. bundled file, which is concatenation of all compiled entries, expected to be in some fixed folder relative to executable
  3. embed bundle at the end of executable, but do not load immediately when executable is opened.
3. save package registry:
   1. as separate file
   2. embed into bundle
   3. embed into executable

every module entry must be pure expression. It can be some computation, but should not require any effect handling by itself.

export fully exposes an item to any importer. protected export exposes item only to importers from the same directory.

[modules stuff](https://thunderseethe.dev/posts/whats-in-a-module/)
https://www.iecc.com/linker/

module visibility:
1. Module declarations can be private or public
2. Modules in a folder can be private or public when named with postfix `.pub`

Modules are collections of exports. They have a signature/schema.
They must be independent from other modules up to an interface.
Modules should provide namespaces. That means we still would like to have explicit file level syntax for modules.

We already have other notions for collections of named things: records for data, schema for databases, interfaces, traits and effects. Each of them have unique features, but probably they can be unified. All of these are types. Schema is probably the most generic.
We may declare operators in modules, but then its spec must be included as a part of the signature.

Roman Храновський, [2/3/2026 6:05 PM]
https://www.reddit.com/r/ProgrammingLanguages/s/hEqWYIqzpz

Roman Храновський, [2/3/2026 6:07 PM]
Must support some form of precompilation of modules and importing of them. We may precompile up to some step, like up to parsing, expanding, optimization, codegen, etc.

Roman Храновський, [2/2/2026 6:14 PM]
https://www.unison-lang.org/docs/the-big-idea/

Roman Храновський, [2/2/2026 6:14 PM]
https://github.com/fragnix/fragnix?tab=readme-ov-file#vision

Structural modeling - Practical Alloy
https://practicalalloy.github.io/chapters/structural-modeling/index.html

Roman Храновський, [2/2/2026 7:34 AM]
https://alloytools.org/alloy6.html

Roman Храновський, [2/2/2026 7:44 AM]
Haskell for all: Type-safe eval in Grace
https://haskellforall.com/2026/01/typesafe-eval


Roman Храновський, [1/28/2026 1:59 PM]
adding methods to a particular combination of generics/parameters to generic

Roman Храновський, [1/28/2026 3:37 PM]
Disentangling unification and implicit coercion
https://www.jonmsterling.com/01JQ/

Roman Храновський, [1/19/2026 4:55 PM]
Solving a math problem with planner programming • Buttondown
https://buttondown.com/hillelwayne/archive/solving-a-math-problem-with-planner-programming/

Roman Храновський, [1/19/2026 4:55 PM]
Planning as a part of flow scope

Roman Храновський, [1/21/2026 10:28 PM]
https://www.reddit.com/r/ProgrammingLanguages/s/P415uTCoXY

Roman Храновський, [1/24/2026 6:41 PM]
Network model - Wikipedia
https://en.wikipedia.org/wiki/Network_model

Roman Храновський, [1/26/2026 8:44 AM]
https://www.reddit.com/r/Compilers/s/cXEJZ7ynyR