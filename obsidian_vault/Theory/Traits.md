https://thunderseethe.dev/posts/traits-are-a-local-maxima/
https://learn.microsoft.com/en-us/dotnet/csharp/methods#extension-members
https://kotlinlang.org/docs/extensions.html#extension-properties
https://en.wikipedia.org/wiki/Extension_method#The_problem
https://en.wikipedia.org/wiki/Extension_method#Naming_conflicts_in_extension_methods_and_instance_methods
https://en.wikipedia.org/wiki/Uniform_function_call_syntax
https://chatgpt.com/c/69985880-5a48-8392-93cf-2d3558b6c7cc
https://www.dhil.net/research/papers/effect_handlers_evidently-draft-march2020.pdf?utm_source=chatgpt.com

Traits (aka typeclasses, implicits, interfaces, extensions, mixins, protocols, etc.) are a way to define a set of behaviors that can be implemented by a type.

The idea is simple - define an interface, and then implement it for a given type.

But we might run into an [orphan instance problem](https://wiki.haskell.org/Orphan_instance). Resolving it basically means proving/guaranteeing coherence of the trait implementations. And it must be global, so coherent across all the participating modules. Meaning there is only one implementation of a trait for a given type, or they are exactly the same.

But actually what we need is unambiguous resolution for a method call on some type. So the implementations must be coherent at these call sites only, which we can name local coherence.

We might look at trait implementations as module-level effects, and force modules to not duplicate effects. So if you import a module that implements a trait for a type, you must not import another module with the same effect, or even do the thing in the current module.

We might go even further with this idea and treat implementations as actual effects in code, thus making method resolution dynamic. The usual implementations add a global handler, but we may set our custom handlers and override the behavior. 

We may define trait implementations as private, so that it is not overlapping with implementations once the module is imported.

from [this paper](https://arxiv.org/pdf/1512.01895) it seems that once we only enforce local coherence, the type checking now depends on the order between the implementation resolution. And that means the program may behave differently depending on how we infer types or inline terms.

Another approach is to define implementations as named values instead, which we need to explicitly apply.