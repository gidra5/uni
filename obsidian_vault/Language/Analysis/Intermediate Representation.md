Intermediate representations are made to simplify certain kinds of analysis of the program. A "good" IR must be _accurate_ – capable of representing the source code without loss of information – and _independent_ of any particular source or target language.
That includes:
1. Abstract Syntax Tree (AST) - a tree, describing the program's structure, usually is an output of the parser.
2. [Flat AST](https://www.cs.cornell.edu/~asampson/blog/flattening.html) - flattened version of AST, primarily useful for optimization of traversing and building tree.
3. [Continuation-passing style (CPS)](https://en.wikipedia.org/wiki/Continuation-passing_style) - an IR, that represents all computation as a chain of continuations, which describes control flow explicitly. Restricts all function calls to accept only values (constants, variables, function literals) and have additional parameter for "continuation", that must be called by its implementation. Useful to make certain behaviors be explicit, like branching, forking, order of evaluation, tail calls, etc. Mostly used by functional programming languages
4. [Static Single Assignment (SSA)](https://en.wikipedia.org/wiki/Static_single-assignment_form) - a kind IR, that imposes restriction that all variables are assigned value exactly once. Useful to detect dead code, set of unused and live variables, redundancy, constant and value range propagation. Similar to CPS in nature, but less powerful, since it can't express control-flow directly.
5. Three Address Code - a kind IR, that imposes restriction on the form of nodes - all of them must have at most three children. It can be considered as a closest to machine code IR. Useful as a translation step before generating machine code, to do [peep-hole optimization](https://en.wikipedia.org/wiki/Peephole_optimization).
6. [A-normal form (ANF)](https://en.wikipedia.org/wiki/A-normal_form) - a king of CPS IR, that relaxes to only require values be passed to functions, without explicit continuations. Useful for functional programs compilation and gives similar benefits to CPS IR, but applies only to eagerly evaluated values. Similar to SSA, because in functional languages variables can't be mutated.
7. [Control-flow graph (CFG)](https://en.wikipedia.org/wiki/Control-flow_graph) - a directed graph, that describes program's control-flow. Has similar usages to SSA.
8. [Value Dependency Graph (VDG)](https://en.wikipedia.org/wiki/Dependency_graph) - a graph that represents dependencies between parts of a program. Useful to detect dead code and to search through different instruction schedules.
9. [Sea of Nodes](https://darksi.de/d.sea-of-nodes/) - a graph view of SSA IR. Combines data flow with control flow, and similar to VDG.
10. Bytecode - a kind of flat IR, that describes machine code of some virtualized computer architecture. Closely models real hardware opcode.
11. Stack VM bytecode - a kind of bytecode IR, that eliminates any explicit parameter passing with parameters taken from implicit stack. Adds stack operations like `push`, `pop` for manipulating values that are to be added or removed from stack. Useful for generating code for stack-based machines.
12. Register VM bytecode - a kind of bytecode IR, that uses limited amount of general-purpose registers to hold live variable values. Useful for generating code for register-based machines

https://github.com/SeaOfNodes/Simple
https://en.wikipedia.org/wiki/Sea_of_nodes
https://en.wikipedia.org/wiki/Intermediate_representation
https://www.reddit.com/r/ProgrammingLanguages/s/aAmy9KtxfU