Syntax is described by formal grammar, which is a set of rules, defined using special symbols.
A rule has following structure:
`name = expression`
where expression is a combination of these operations:
1. terminal string, delimited by double quotes.
2. non-terminal symbol - a name of some other rule.
3. infix pipe `|` - defines a choice of multiple variants that should match the rule.
4. grouping `()` - delimits where different rule expressions end.
5. postfix `*` - repeat zero or more times.
6. postfix `+` - repeat one or more times.
7. postfix `?` - optional expression.
8. prefix `~` - anything except the following expression. Takes precedence over all other operators.

Syntax usually describes a hierarchical structure of input text as a syntax tree. Syntax tree fully represents input, but usually carries redundant info, like what particular variants of the construct were used or syntactic sugar over some other more primitive constructs, that does not really impact further analysis, but needed to reconstruct original source. 
These redundancies can be replaced by more abstract nodes that drop information about particular syntactic variant of the construct, or be replaced by equivalent tree structure that will reduce amount of core/primitive language constructs used by Abstract Syntax Tree. 

Thus resulting output from syntax analysis is an Abstract Syntax Tree.

Space is mostly insignificant, except delimited application. Delimited application is used as a base case for function call syntax.

https://craftinginterpreters.com/representing-code.html
https://www.oilshell.org/blog/2016/10/20.html
https://www.reddit.com/r/ProgrammingLanguages/s/y4K2RaPALI