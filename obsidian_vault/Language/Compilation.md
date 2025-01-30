Compilation is a process of producing a low-level representation of code for some target architecture.
Current implementation targets only a custom [[Virtual Machine|VM]] based on lc3 CPU architecture.

Compiler follows these steps:
1. Compiler frontend
   1. Lexing (tokenization)
   2. Producing AST
   3. Emitting any syntax errors that were found
2. Transformers
   1. Type-checking
   2. Optimization
   3. Simplification using some identities for used operations
3. Compiler backend
   1. Traverse AST and produce list of "chunks" and data
   2. Generate bytecode for target architecture from chunks
   3. Generate buffer containing image, that can be accepted by [[Virtual Machine|VM]]

https://wren.io/performance.html
https://www.youtube.com/watch?v=QdnxjYj1pS0&ab_channel=AdamMcDaniel