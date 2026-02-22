https://matklad.github.io/2025/12/09/do-not-optimize-away.html

Suggest optimizations as codemods. User reviews and accepts/declines.

Provide "analyze" command that will look for all optimizations that are applied to the code and show when they are applied.

Optimizations that can improve algorithmic complexity:
* folds through fusion
* recursion through memoization
* loops through tabulation?
* caching in general
* virtualization?

https://youtu.be/WIZf-Doc8Bk?si=ry96QfDoHLkmbffB

The programmer's optimization is in a trade-off between internals knowledge and independence from the implementation. The better you know how exactly the program works at runtime, the better you can optimize it. But the more you know about the internals, the more you bake in the knowledge of the implementation, thus making it harder to change the internals.