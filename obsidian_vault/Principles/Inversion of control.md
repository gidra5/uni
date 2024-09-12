Suppose we have modules A and B, where B depends on A, for example, by importing x from it, and one side of that dependency graph is labeled as "user code" and the other is labeled as "system code", which establishes expected roles and domains (or i would say areas of control) in codebase for them:

![[ioc_diagram.excalidraw|1000x200]]

We also postulate that "system code" must not depend on "user code" *directly*. In that case diagram above is considered to violate IoC principle, since module B directly imports from module A.

Notice that there is an implied third entity - interface of the imported module:

![[ioc_diagram_2.excalidraw|1000x200]]

This makes it explicit, that we actually made a decision.
The position of separation between labels defined that module B depends on interface that is not controlled by its developers, but rather by its users.

One important detail is why dependencies are shown with these directions, but not some other direction - it can be determined by how system is expected to behave upon changes to these parts.
If interface A is modified by available entries, then one of them will break - if new fields added, A will break the interface, if fields used by B removed, then it will break instead. 
If module A is modified such that it does not provide all necessary fields to implement Interface A, then module will be considered broken, not interface. But it is allowed to export more fields
Similar logic with module B - if it uses fields that does not exist on the interface, the module is broken by violating interface.
The interface is "single point of truth" for available fields, that both sides should satisfy.

So to soften dependency, we make it indirect, by moving Interface A in control of system code:

![[ioc_diagram_3.excalidraw|1000x200]]

Notice that now module B does not need to explicitly mention module A, it only declares that there must be some external items, that be provided to use the module B. That forces module A to explicitly pass fields to B.

Another feature is that particular syntax for expressing that relation is irrelevant, which allows us to apply it to other cases, like passing callback instead of sequential calls in user code:

![[ioc_diagram_4.excalidraw|1000x200]]

That may look like a Hollywood Principle "Don't call us, we'll call you". Indeed, instead of sequentially calling B and makeA, we pass makeA to B , so it can decide when to call it instead, thus "inverting control (flow)". Notice that syntactically calls to makeA and B were swapped. Generally that is what happens when inversion of control applied to expressions - the computation is turned "inside-out".

That allows us to formalize application of IoC: 
1. determine a user-system boundary
2. determine a subject of inversion
3. move subject of inversion under system's area of control
It might even be possible to automated, if suitable heuristics for first two are found.

Notice that subject of inversion is not restricted to something particular - just like it can be interface or call to some function, it also can be some data or parameters. That means it can be applied universally, since much more things fit the application process, than just OOP architectures.

Once application of that principle is formalized, it is less of a principle and more a technique, that in exchange for increased complexity, lovers coupling between user and system domains.

Also notice how in case of callbacks IoC is more complicated than direct counterpart - it is much harder to think through control flow that way, since it was obscured by indirection. That also surfaces the cost of such inversions - you will always be required to create additional data that implements the required interface.
Notice that in some cases callback passing can be wrapped into nice APIs, like Promise, Future, Observable or EventEmitter and even sugar-coated with async/await and similar, which hides created complexity of IoC.

Yet once boundary is removed, the complication from IoC loses all benefits, which allows us to use direct approaches and follow KISS instead:

![[ioc_diagram_5.excalidraw|1000x200]]

When combined with acyclic dependency graph, it fundamentally defines layered achitecture.
# Single point of truth

