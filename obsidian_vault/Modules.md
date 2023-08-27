Modules consist of a list of declarations. These are possible declarations:

1. Import local module, relative to current file, or to the root of a project
2. Use external module, via a link to repo or a local package
3. External variables, that must be passed when module imported/used
4. Definitions, that are identifiers with assigned value. Can be exported or not.

Basic steps for parsing a file:

1. Top-level is a list of [[Modules|module]] declarations
2. Each declaration defines a name and a bound value, which is not parsed until all declarations are resolved.
3. After all declarations resolved parse values accounting for all available bindings.
4. Reduce some syntactic constructs to a simpler form, where only a restricted set of operations is allowed.