Gradual typing explained: https://elixir-lang.org/blog/2023/09/20/strong-arrows-gradual-typing/ 
We introduce type `any` which means we can't know type of its value until runtime, thus requiring runtime checks to verify its type, unless we can statically analyze how it is used and avoid checks

The rudimentary approach is to check when a value is of type `any` but expected to be of some concrete type, for example number. In such cases we generate *precondition* code, that will verify validity of passed value, and throw error otherwise.
If it is possible to prove that function is *strong*, we omit precondition code.
Strong functions are such functions that will infer return type that is subtype of expected return type, when type of argument is inverted with `not` operator. More formally `f is strong <=> (f: a -> b) and (f: not a -> c) and (c <: b)`