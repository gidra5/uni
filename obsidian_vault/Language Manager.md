A CLI application that allows to manage language's toolchain (update, install, remove)

A toolchain contains:
1. Compiler
  1. Frontend
  2. Backend
  3. Transformers (extendable)
  4. Analyzers (extendable)
  5. Watch mode
2. Virtual machine
3. Debugger (extendable)
  1. Watch mode
  2. Break points
  3. Inspection
  4. Step by step execution
4. Interpreter (repl)
5. Formatter (extendable)
6. Linter (extendable)
7. Language Server
8. Test runner
  1. Snapshots
  2. Property-based testing
  3. Mocking
  4. Watch mode
9. Benchmark runner
  1. Memory usage
  2. Speed
  3. Utilization
  4. Progressive statistics
10. Language manager itself (extendable)
11. Package manager
  1. Package initializer with templates
  2. Builds caching management
  3. Dependencies management
  4. Package search
12. Extensions management
13. Documentation management

Language manager can generate and maintain dependency list from package manifest, which may contain package descriptors in multiple formats.
