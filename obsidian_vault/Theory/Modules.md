Modules are a set of definitions.
Definitions can be:
1. type definitions
2. method on type definitions
3. modality definitions
4. trait definitions?
5. trait implementation on type
6. annotation definition
7. extension - add unprivileged methods in unrelated modules
8. state machines
9. dataflow circuits?
10. actors

## Dataflow

We define dataflow as a graph that transforms incoming signals into outgoing ones.

These are inherently passive - they only execute once some values are pushed through incoming signals. This also means they are lazy - downstream computation may even not execute.
Transformations can be cached if the inputs are the same as previous.

We can connect ef
