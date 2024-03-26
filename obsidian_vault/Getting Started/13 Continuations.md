Continuations represent "the rest of the computation"
Think about the code that called a function. From the perspective of calee it is "the rest" to which we give the results.
You could say that if `return` was a function value, not a statement, then it is a continuation.
We can get the continuation for a particular point in code by using code labels.
Continuations are values, so they can be passed to other functions, allowing for a more direct control flow