So, uh, patterns, am i right? They are often highlighted as an advanced feature brought from functional programming. Some of them are even extending the idea further, like rust or elixir, and kind of js recently (links). But is it the end? Can we go further? What it absolute maximum we can get from them? If you wondered that just like me, boy do i have a story for you. And you might find something even more interesting in the process...

# The base language
Lets start with the base language we are going to add patterns to and play with. Its quite simple. 
We have three kinds of values:
1. Primitive - Boolean, number, string
2. Record `record { ... }`
3. Function/lambda `fn x { ... }`

And a few niceties like:
1. Code blocks/scopes `{ ... }`
2. Let declarations `let x = ...`
3. If statements/expressions `if ... { ... } else { ... }` (else is optional)
4. Assignments `x = ...`
5. Field access `x.y`
6. Sequencing `x; y; z`. Implied when newlines are used.

Thats it. It's not radically complex, but it has most of the things that interact with patterns in some more or less direct way
It actually can do practically all the relevant things for you, so it is quite expressive. Besides, lambdas alone make it turing complete.

Here is what it looks like:
```
let records = record { x: 1, y: 2 }
let primitives = record { bool: true, bool2: false, int: 1, float: 2.3, str: "hello" }
let functions = fn x { x + 1 }

let scopes = { x := 1; y := 2; x + y }

primitives.bool = false

if primitives.bool {
  primitives.bool2 = true
} else {
  primitives.bool2 = false
}
```

I'm using the syntax I invented for my language, which is hopefully feels familiar enough to you.

To this basic language we can add patterns - a kind of binding that automatically breaks down composite values like records. And in its simplest form thats it, a deconstruction syntax sugar:
```
composite := record { x: 1, y: 2 }
...
record { x, y } := composite
```

But at that point we already can see key feature of patterns - they can fail if the actual value does not include necessary fields required by the pattern. Because if we cant find a value for that binding, we cant really do anything else.

# The language design principles
Before we actually start I want tell you a little story that will motivate any changes we do to this basic premise.

What is it that makes us want to expand on this simple features? When you look through a few mainstream languages, you may find a lot of commonalities in how community reacts to patterns and pattern matching. 

First you are alienated by this new unfamiliar tool. You don't really understand what it does, and what it gives you in return. Most of the coworkers will not be able to read it, forget about using it. But you try it in your free time on some pet projects, little by little.
If you use it for long enough, you start understanding it better and find yourself using them more and more. If you get really excited about them, you may even try to use them literally *everywhere*. 

Declaring multiple variables? Lets do it in a single statement with a pattern. Switch statements? Slap a pattern on that bad boy and express each case much more clearly. If statements? They are just poor man's switches. Functions? Just throw everything in a single parameter with whatever structure you want. It feels great.

You run the compiler or interpreter and... you get an error. The syntax is unsupported. You cant use patterns in that place. Matches in switch statements are much more barebones than you expected. And the declarations you wrote cant be typed nicely.

Your intuition failed you.

That is the point when you hit the wall of this feature. You found some quirks in its semantics and places where it doesn't work. 
Yet some of these places feel so beautiful, so natural and intuitive that you start feeling the itch to write a feature request for it, explaining every bit of detail about it and how it will improve the language.

But thats a story with a tragic end. The people actually developing and designing the language must think of every possibility how to will affect the language. The bigger it gets, the harder it is to add more. As much as your idea is beautiful, it may never get through the piles of other work people need to do to actually make it work. Now you are left with incomplete language and, if unfortunate enough, constant reminder of how it could've been better, unsatisfied by every second of using it...

*a single tear dropping down*

I may be overly dramatic, but thats how I feel with most of the mainstream languages. They are great, powerful, useful, performant, but always feel incomplete. And "pattern matching" can be replaced with many other features - lambdas, iterators, traits, generics, etc. When you use them long enough, you will go through this story once more. Yet I believe it can be solved once and for all. I think... 

To solve this "language incompleteness" problem, I present you a few design principles that I followed during my thought process:
1. Semantic completeness - if there is some correspondence we find, it must be complete in both ways. For example we could treat matching failures as booleans. And that suggests that we may act on them as such as well. We could also interpret it in other ways, like instead of restricting allowed syntax, invent reasonable semantics for it. One notable thing it covers is binding duplication.
2. Turing completeness - the feature must be computationally rich to the point that it can replace the rest of the language. That is kind of a questionable premise, but bear with me. While that may be impractical and even create performance footguns for almost no reason, it will show us the boundaries of this kind of feature so we could be sure there is no point going further.
4. It should compose with everything else. So we could try inserting it anywhere, and anything can be used inside them as well.

Basically, if we will eventually need to expand on this feature, we might as well think through it as much as possible, so that we have a clear blueprint for how it will interoperate with the rest of the language. It might even feel a bit overwhelming at first, but we don't have to implement everything at once, we can just leave things for later.

By following them you make sure that the intuition we've built for patterns always holds and that any problem, anywhere in the language could be solved in that way if you wish. And im not talking about if you should, thats the question you need to answer yourself, im here to just give you the tools you wish for.

# The implications
So, what do these principles imply in the case of patterns? Well, a lot.
Lets first identify some intuitions we have around patterns:
1. They mirror construction syntax
2. They are used in match expression as conditions, similar to how boolean expressions are used in ifs.
3. It compares values from the pattern with whatever it finds in the matchee and decides the success that way.

That is basically our roadmap for what to think through for now. Later on we will find even more such breadcrumbs to feed our fantasy.
We'll need to consider every combination of principle-intuition and think of what they imply. The answer may not be unique, but it will surface the possibilities that there are.

# The match operator

It is worth a while to think about how could we decompose the pattern matching. Since it is actually not a trivial operation, but a combination of several. We may decouple the matching result and actual binding into separate operations and consider how it works in different contexts.

The matching result consists of the success flag and a list of matched values with corresponding names they should be bound to. This gives us practically all the information we could get by pattern matching. 

Now lets go through the different constructs we have in our base language:
1. Declarations
2. If expressions
3. Functions
4. Assignments

# first class patterns

That highlights existential-like behavior, which hints on how we would type them if thew were first class values. But i'm getting ahead of myself.

# Conclusion

For me, the best conclusion from this are the design principles and how to use them. They really make designing a language a lot more fun, since there are a lot of things you can expand on in that way. It's what made me almost obsessed with thinking though all kinds of features in my language, many of which don't really have any clear syntax, just the semantics it would need to fill in. I really need to find some time to play with them in a more direct way...

Anyway, I hope it was as interesting to you as it was fun for me.
