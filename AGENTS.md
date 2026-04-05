## Project structure
The project implements a programming language called "uni".

The structure of the project is as follows:

1. `bootstrap` - contains the implementation of language and tools in the language itself.
2. `c` - the c implementation of the language. Supposed to provide the optimal performance.
3. `examples` - contains examples of the language in action. Mini projects, solutions to simple problems, advent of code, euler project, etc. Anything that showcases usefulness of the language.
4. `obsidian_vault` - contains the research, reference, getting started guides, other relevant theory. Everything about documentation of the project.
5. `playground` - contains web-based playground for the language. Allows writing uni programs and running them in the browser.
6. `runtime` - contains lower level implementation of some of the language features, that are used during codegen of machine code.
7. `ts` - the typescript implementation of the language. The proof of concept, comprehensive test suite, and the reference implementation. Outlines the language implementation without strict constraints on performance, but with emphasis on correctness.
8. `miniuni-highlight` - the syntax highlighting extension for vscode.
9. `miniuni` - a simple, stripped down PoC language implementation

## Development

I can update your code at some point to fit my taste and you should try to run with it, not override immediately. If you see a problem with my changes, first ask questions why they were made and what problem do you see with it. I will consider it and answer.

Try estimating the size of your implementation first. If the feature is complex and requires large changes across multiple files, generate a plan for the changes and allow me to review it before implementing it. I may update the plan according to my own taste. You should also review the plan before implementing it and look for missing details or ambiguities. Once the plan is ready to be implemented, it will be marked as "approved" at the end. 

If the node executable is not found or is too old, try using node v22 installed with nvm.

If there are questions, conflicts, ambiguities found, do not hesitate to ask and resolve them productively.

### Testing

While working on the implementation of features, follow TDD approach. Write test cases first, then implement the feature such that the test case passes. Before implementing a feature, allow me to review test cases and update them if necessary. For other tasks not directly related to the project's source code implementation you may start working immediately if acceptance criteria are clear.

When designing test cases, try to follow the language's design principles, outlined in the readme and documentation.

When implementing a feature, write the code with extensive assertions whenever you expect a particular program state, not captured by types (the field being not empty, or a parameter being more specific, like n>0, etc). If the interface of the feature is small enough, write a property-based e2e test that verifies the implementation never throws assertion errors or generic runtime errors like "cannot read prop of undefined" on any input acceptable by the types. As an example, look at the `miniuni/src/tokens.ts`, `miniuni/tests/tokens.test.ts`, `miniuni/src/parser.ts` and `miniuni/tests/parser.test.ts` files.

There are multiple kinds of tests we can write, described in `obsidian_vault/Language/Quality Assurance.md` in the docs. Pick the most suitable one for your feature description and constraints.

Prefer property-based testing, when you have a choice for constants or need data/example generation. That means our tests should pass for any possible choice of constants, and not just for some specific ones.

Run the coverage test and look at the reports. Use them to derive new meaningful e2e test cases that would illustrate specific behavior. We do not strive for 100% coverage, but we want to cover all the interpreter paths and other user-facing behaviors.

### Benchmarking
When assessing the performance, always get reliable evidence.

Write benchmarks that measure scaling behavior of features or specific examples. Estimate empirical algorithmic complexity that way and compare with theoretical derived from the implementation code. Analyze this difference, if any, to see if it is expected due to interpreter overhead or if you missed something when estimating the theoretical complexity.

Measure both the memory, cpu usage and wall time. If applicable, you may introduce implementation specific stats like amount of calls to the specific function, or whatever makes sense for a particular feature.

Always do a baseline run first, saving the results to a file, and then comparing later runs against these baselines using vitest features or scripts if support for is limited (since it is an experimental feature in vitest).

Profile the code to find hotspots and bottlenecks both in memory and time, that could improve the performance.
