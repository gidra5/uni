After parsing out AST, variables need to be resolved.
We need to know which values they actually refer, because otherwise that ambiguous.
we traverse the AST, building out another tree of scopes, each scope having a hashmap of names.
every time we enter new scope we insert a child to the current scope and move to it.
when we lease current scope, we make its parent new current scope.
when we encounter some kind of variable declaration in scope, we add it to current scope's hashmap.
when we encounter read from a variable, we resolve it with full path in scope tree, where every element except last is an index into respective children, and last one is the name to lookup in hashmap.
the entry in hash map is called a symbol, and contains information like location and type.
The top hash map is called a symbol table.