## Project structure
The structure of the project is as follows:

1. `bootstrap` - contains the implementation of language and tools in the language itself.
2. `c` - the c implementation of the language. Supposed to provide the optimal performance.
3. `examples` - contains examples of the language in action. Mini projects, solutions to simple problems, advent of code, euler project, etc. Anything that showcases usefulness of the language.
4. `obsidian_vault` - contains the research, reference, getting started guides, other relevant theory. Everything about documentation of the project.
5. `playground` - contains web-based playground for the language. Allows writing uni programs and running them in the browser.
6. `runtime` - contains lower level implementation of some of the language features, that are used during codegen of machine code.
7. `ts` - the typescript implementation of the language. The proof of concept, comprehensive test suite, and the reference implementation. Outlines the language implementation without strict constraints on performance, but with emphasis on correctness.

## Development
I can update your code at some point to fit my taste and you should try to run with it, not override immediately. If you see a problem with my changes, first ask questions why they were made and what problem do you see with it. I will consider it and answer.

Try estimating the size of your implementation first. If the feature is complex and requires large changes across multiple files, generate a plan for the changes and allow me to review it before implementing it. I may update the plan according to my own taste. You should also review the plan before implementing it and look for missing details or ambiguities. Once the plan is ready to be implemented, it will be marked as "approved" at the end. 

While working on the implementation, follow TDD approach. Write test cases first, then implement the feature such that the test case passes. Before implementing a feature, allow me to review test cases and update them if necessary. 

When designing test cases, try to follow the language's design principles, outlined in the readme and documentation.

There are multiple kinds of tests we can write, described in `obsidian_vault/Language/Quality Assurance.md` in the docs. Pick the most suitable one for your feature description and constraints.

Prefer property-based testing, when you have a choice for constants or need data/example generation.

If there are questions, conflicts, ambiguities found, do not hesitate to ask and resolve them productively.