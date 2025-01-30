Benchmarking
Sample problem size by providing it as a param
gen problems from it and execute
Estimate time and space complexity during execution 
Gather statistics, compute pN and std dev
Realtime updates

Genetic algorithm to compute actual expression for the complexity class, then finding constants that minimize error

Cumulative computations so that progression can be viewed. Track convergence to estimate stop point

Estimate avg/best/worst complexity by gradual descent. Start with set of random guesses and an avg time complexity, update each guess in direction of better/worse perf, while keeping problem size fixed, get complexity from new points.

Present found examples

https://arxiv.org/pdf/2310.09774
https://ksiresearch.org/seke/seke15paper/seke15paper_213.pdf

POC: https://github.com/gidra5/js-benchmarking

https://people.freebsd.org/~lstewart/articles/cpumemory.pdf
https://blog.reverberate.org/2021/04/21/musttail-efficient-interpreters.html
https://spidermonkey.dev/blog/2024/10/16/75x-faster-optimizing-the-ion-compiler-backend.html