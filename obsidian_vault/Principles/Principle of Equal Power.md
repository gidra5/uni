
All abstractions must be equal in power to lower level code.

That guarantees full power for developer and ability to side-step the abstraction in case it is insufficient in some way.
The side-stepping code must be interoperable with higher-level code.

Related to abstraction granularity and semantic compression of code.

Granular abstraction is one of the methods that precisely satisfies the principle.
And semantic compression is the method that allows building granular abstractions from unabstracted code.

The principle can, and sometimes must be violated. For example when the abstraction is accessible by third parties (e.g. rest api to http server), principle must be violated to keep server secure.

The "opposite" is Principle of Least Power, when you desire to keep complexity at minimum. Its not exactly the opposite, because they both can be satisfied in some cases. The usual example is the existence of ABI and native bindings between languages. They keep high-level abstraction of the language, while allowing to use lower level tools and languages directly. You could say that by choosing high-level language we follow Principle of Least Power, since usually high abstraction = low power, but
