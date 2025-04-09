Testing compilers and interpreters is difficult. 

Given a test program, and a potentially buggy compiler, there are essentially four questions that you can ask:

1. Does this piece of test code correctly compile, or correctly fail to compile, under certain circumstances?
2. Does the compiler produce the correct/expected diagnostic output (i.e. errors or warnings), under certain circumstances?
3. Does the program, when compiled under certain circumstances, do the right thing when run?
4. Does the compiler, under certain circumstances, produce expected code?

"under certain circumstances" means given some configuration flags, that may change the expected output (for example to produce warnings or errors)

Common ways to do that:
1. Snapshot testing with example programs, based on some translated code from other languages, or a solution to some coding task, like Advent of Code days or Project Euler.
2. Sanity checks that you expect to always be true or false:
  1. Compiler stages newer throw
  2. Data structure invariants are respected
3. Smaller examples that target specific features like:
  1. scoping
  2. function calls
  3. binding
  4. type inference
4. Fuzzy testing programs to find counter examples that violate some expected properties. For example:
  1. executing any code in block scope always leaves parent scope unmodified.
  2. type system is sound
5. Snapshot testing error reporting on a set of motivating examples for them.
6. Benchmarking a set of examples that are going to accentuate different characteristics, like:
  1. Memory footprint (max, min, avg, mean, std dev, etc.)
  2. Regressions in time of execution.
  3. Size of emitted code
  4. Overhead of features compared to simpler code that does the same work.
7. TDD on any non trivial minimal examples that reveal some existing bug. 
8. Bootstrap testing:
  * Compile the compiler. Call the result "A".
  * Re-compile the compiler using the compiler "A". Call the result "B".
  * Re-compile the compiler using the compiler "B". Call the result "C".
  * "B" and "C" should, if your compiler is deterministic, be bit-for-bit identical. You should test this before any release.
9. Mutation testing - verify that the tests detect random unwanted changes. It additionaly fixates the code behavior. The more "mutants" die, the larger logical coverage is for the test suite.

Tests should be platform independent - any machine that runs them will see identical results.

https://www.reddit.com/r/Compilers/comments/z8jovo/how_do_you_test_compiler_projects/
https://langdev.stackexchange.com/questions/1544/how-to-test-a-compiler-interpreter
https://github.com/smarr/are-we-fast-yet
https://github.com/sampsyo/flatcalc/blob/c5bbe7bd79f98a3b857f0432d4739a3f4f6241bd/src/main.rs#L118-L136

https://tigerbeetle.com/blog/2023-03-28-random-fuzzy-thoughts

https://pitest.org/