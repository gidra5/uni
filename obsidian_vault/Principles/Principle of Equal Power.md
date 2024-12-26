
All abstractions must be equal in power to lower level code.

That guarantees full power for developer and ability to side-step the abstraction in case it is insufficient in some way.
The side-stepping code must be interoperable with higher-level code.

Related to abstraction granularity and semantic compression of code.

Granular abstraction is one of the methods that precisely satisfies the principle.
And semantic compression is the method that allows building granular abstractions from unabstracted code.

It is most relevant to library, framework and tool developers.

The principle can, and sometimes must be violated. For example when the abstraction is accessible by third parties (e.g. rest API in http server), principle must be violated to keep server secure. We want to limit the power of third parties, so that they can't break the system. Alternative is not limiting, but checking what is being executed, usually via some permission or type system, which yields Principle of Least Privilege. 

The related principle is Principle of Least Power, used when you desire to keep complexity at minimum. Its not exactly the opposite, because they both can be satisfied in some cases, but they can easily conflict with each other. The usual example is the existence of ABI and native bindings between languages. They keep high-level abstraction of the language, while still allowing to use lower level tools and languages directly. 
You could say that by choosing high-level language we follow Principle of Least Power, since usually high abstraction = low power, but at the same time it allows side-stepping the abstraction by using low-level tools directly, which satisfies Principle of Equal Power.

One way to look at it is that *the language* must have equal power, but *the environment* that executes it must have the least power. That allows to have best allowed experience possible in given environment.

One more way to look at it is that higher abstraction levels must have at least the power of the lover level abstractions it uses.