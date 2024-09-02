Syntax is described by formal grammar, which is defined using special symbols[^1], generally `->, *, +, ?, |`.

Syntax usually describes a hierarchical structure of input text as a syntax tree. Syntax tree fully represents input, but usually carries redundant info, like what particular variants of the construct were used or syntactic sugar over some other more primitive constructs, that does not really impact further analysis, but needed to reconstruct original source. 
These redundancies can be replaced by more abstract nodes that drop information about particular syntactic variant of the construct, or be replaced by equivalent tree structure that will reduce amount of core/primitive language constructs used by Abstract Syntax Tree. 

Thus resulting output from syntax analysis is an Abstract Syntax Tree.

[^1]: https://craftinginterpreters.com/representing-code.html
