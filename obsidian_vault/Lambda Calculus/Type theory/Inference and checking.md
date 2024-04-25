Type inference is done in two directions:
1. Infer type of all variables that are expected to exist for a given expression to be valid. That basically infers types from usage.
2. Given a set of variables with defined types for each of them, assert that they fit into expected context of every expression. That checks that if variables are given annotations, they are used correctly, if not, then its checked against the inferred type.

Inference from usage gets a lower bound on what the value can be. 
Inference from arguments gets upper bound on what is even passed there.
They should always have that subtyping relation.

That means we do two passes, one for each direction. 
Rules for inference and type checking may be considered mirror reflections of each other.

https://davidchristiansen.dk/tutorials/bidirectional.pdf