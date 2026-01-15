https://matklad.github.io/2025/12/09/do-not-optimize-away.html

Suggest optimizations as codemods. User reviews and accepts/declines.

Provide "analyze" command that will look for all optimizations that are applied to the code and show when they are applied.

Optimizations that can improve algorithmic complexity:
* folds through fusion
* recursion through memoization
* loops through tabulation?
* caching in general