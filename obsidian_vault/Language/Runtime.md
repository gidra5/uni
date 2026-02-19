Runtime includes:
1. Concurrency/scheduling, including gpu
2. reactivity engine
3. query scheduling engine 
4. unification engine
5. C runtime
6. Reflection
7. Device communication
8. Dynamic typing
9. Track modalities dynamically

https://github.com/gmarkall/advent-of-ptx
https://github.com/maierfelix/nvk

There is also a compile-time runtime, allowing for evaluation of code at compile time.
It also includes:
1. macro system
2. type system
3. constant folding
4. decorators and annotations

Allow targeting really small programs. Cpu cache is 32k data 32k code in modern cpu, and we must be able to work within these limits to leverage the most performance

https://www.reddit.com/r/ProgrammingLanguages/s/u2cGou6B4j
https://www.reddit.com/r/ProgrammingLanguages/s/UzCjUTWvEQ
https://www.reddit.com/r/ProgrammingLanguages/s/QwbC2v4iHj