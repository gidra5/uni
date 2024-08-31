

When parser realizes that input has invalid structure there are several ways to handle it:
1. Insert expected tokens, continue as if they were in the input
2. Discard tokens that come next, until we meet expected next token (aka "panic mode")
3. delegating to the parent structure for handling.
4. replace erroneous construct with suitable placeholder node and continue with parsing the rest.
5. search for a minimal sequence of changes to input string so that it becomes parsable
6. changing token stream

First case makes sense when some structure *must* be at the current position, for example if we encounter prefix operator and then postfix right after. Neither of them can be without an operand, and it *must* be before postfix but after prefix. Thus we insert a node of expected type, a kind of placeholder value.

Second case makes sense when some token was expected to appear by that point, but didn't. For example if inside parentheses expression was not immediately followed by a closing parentheses. That may just indicate some typo inside the expression, and assuming parentheses are balanced, we discard any following tokens until we find closing parentheses. Another example related to balanced tokens, is the case when unexpected closing token was encountered - in that case it only makes sense to discard illegal token and continue as if it wasn't there.

Third case makes sense when not enough details is known about error case, so we unwind call stack up to a part of the parser that will know how to handle the error with other two methods. For example if token stream unexpectedly ended or some "banned" tokens were met and we are too deep in parsing tree to report anything more useful than stating the facts. 

Next case is suitable for anticipated errors (aka "error production"). We try parsing tokens that come next as some error construct, if parsing was successful we can safely report an error an return suitable placeholder depending on where error was detected.

Fifth case is more of a theoretical possibility than actual technique for handling invalid input, because applied changes may be completely unreasonable or unexpected, thus it is applicable only on small scale, where it will be easy to reason about changes. Besides practical concerns, there is performance to think about, since it is likely to become combinatorial problem, which scales extremely poorly.

Last case makes sense for typos like when writing identifiers or keywords, but probably requires much more work to be done properly.

One could say that it is useful to be conservative with application of these strategies, so that it doesn't create cascading errors.

One useful observation is that since syntax tree is a hierarchy, errors that occurred in separate branches are probably unrelated as well. Making syntax that supports that assumption is really useful not only for detecting root causes, but also for keeping syntax understandable.
That is also a reason why other heuristics for error handling work.

# Implementation

cases for ignoring tokens:
1. unexpected closing tokens
2. missing closing tokens - discard until found.

cases for inserting tokens:
1. combinations of prefix, infix, postfix and mixfix expressions that are missing operands.

https://craftinginterpreters.com/parsing-expressions.html
https://www.digitalmars.com/articles/b90.html
https://www.tutorialspoint.com/compiler_design/compiler_design_error_recovery.htm
https://www.geeksforgeeks.org/error-recovery-in-predictive-parsing/
https://supunsetunga.medium.com/writing-a-parser-syntax-error-handling-b71b67a8ac66
https://gtu-paper-solution.com/Paper-Solution/CompilerDesign-2170701/Winter-2018/Question-2-b