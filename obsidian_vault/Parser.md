Basic steps for parsing a file:

1. Top-level is a list of [[Modules|module]] declarations
2. Each declaration defines a name and a bound value, which is not parsed until all declarations are resolved.
3. After all declarations resolved parse values accounting for all available bindings.
4. Reduce some syntactic constructs to a simpler form, where only a restricted set of operations is allowed.

Any parsing requires [[Tokenizer]] - it splits plain text into list of tokens. 

After tokenization is done its time to build [[Token Tree]], clean it from comments and then build [[Syntax Tree]].