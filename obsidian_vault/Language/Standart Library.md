---
aliases: std
---

Includes tools for:
1. Networking
  1. HTTP
  2. WebSocket
  3. servers
  4. TCP
  5. UDP
2. Media processing
  1. Play video
  2. Play sounds
  3. Display graphics
3. input handling
  1. Keyboard
  2. mouse
  3. gamepads
  4. stdin
4. parsing (following "parse, don't validate")
5. string formatting
6. containers
  1. arrays
  2. maps
  3. sets
  4. stack
  5. queue
  6. option
  7. result
7. memory allocation
8. Iterators
9.  generators
  * function wrapper
  * yield effect
10. arbitraries
11. streams
12. animation interpolation
	1. must allow reifying animation principles https://youtu.be/uDqjIdI4bF4?si=1WEmqHQnBs59iEdW
	2. https://www.youtube.com/watch?v=gFTYNp0HWTg
	3. https://www.youtube.com/watch?v=p8scn9zyvJA
	4. https://www.youtube.com/watch?v=iMV9Tlpo1wY
13. math
  14. linear algebra
  15. [tensors and tensor graphs](https://dl.acm.org/doi/10.1145/3704865)
  16. number theory
  17. complex
  18. quaternions
  19. dual
  20. geometric algebra
  21. [interval arithmetic](https://buttondown.com/hillelwayne/archive/a-brief-introduction-to-interval-arithmetic/)
  22. derivatives
  23. integrals
  24. differential equations
  25. interpolation and extrapolation
  26. fft
  27. statistics and probability sampling
  28. [reference frames and geometry](https://www.cs.cornell.edu/~asampson/blog/gator.html)
  29. rng 
    * [quasirandom number generators](https://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/)
    * fast prng
    * most statistically uniform prng
    * hardware rng
14. styling
15. cli parsing
16. reflection 
17. process env
18. ffi
19. asm
20. localization and internationalization 
21. file system and io
22. time and timezones
23. physics
24. console
25. structured logging 
	1. https://loggingsucks.com/ 
	2. allow only enabling a subset of log hierarchy
	3. allow log levels
26. measures (kg, meters, etc)
27. regexp
28. functional stuff
  29. monads
  30. functors
  31. [lenses](https://github.com/akheron/optics-ts)
29. crypto
30. compression
31. encoding (json, yaml, base64, etc)
32. hashing
33. data structures
34. algorithms
35. caching
36. concurrency
37. primitive utilities
38. plotting
39. error correction codes
40. generic device interface
41. signals
  * value wrapper
  * derived computation
  * effectful computation
42. event systems
43. reactive streams
44. [conflict free data types](https://github.com/HowProgrammingWorks/CRDT)

Signals (signal, derived, effect), generators (gen and yield), iterators and events through channels
https://julesjacobs.com/2023/09/21/generalizing-itertools.html
https://www.reddit.com/r/ProgrammingLanguages/s/f9EDIwWfFx
https://rolph-recto.github.io/blog/introduction-to-tarjans-path-expressions-algorithm.html

https://buttondown.com/hillelwayne/archive/microfeatures-id-like-to-see-in-more-languages/

Roman Храновський, [2/16/2026 8:48 PM]
Caching:
1. Memo on functions,generics, macros, eval
2. "Materialized view" on tables
3. Indices
4. Channels?
5. Effects handling

Invalidation, miss, eviction 

 Virtualization:
1. Lists, tables, maps, (multi)sets
2. Threads, vectors, channels?
3. Environments?
4. Heap?
5. Ast in macros
6. Stacks for values, calls, handlers.
7. arbitrary precision numbers (bigints and bigfloats? if it even makes sense)

Swapping
Is it a kind of caching?

They are duals of each other, kinda. One trades space for time (we get result faster), other does the opposite, trades time for space (we can manipulate larger data transparently, but will hit delays on misses).

Roman Храновський, [2/16/2026 8:56 PM]
Probabilistic sampling or hashing. Can trade accuracy for time/space. Like we can compute small hashes and compare them instead - really fast but it does not make us 100% sure it is correct.

caching directly impacts performance characterisitics of the program, thus the compiler shoould be aware of it.

Roman Храновський, [2/3/2026 6:13 PM]
https://www.reddit.com/r/ProgrammingLanguages/s/FQVrrzVqMt

Roman Храновський, [2/3/2026 6:14 PM]
Rust allows equal power through unsafe code, which is ok, but unrigorous and foregoes the benefits of safe rust.

There is something called dx12 work graph