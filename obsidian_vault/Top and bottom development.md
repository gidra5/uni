You mav divide development strategies into two categories:
1. Development of high level pieces of the application (top development)
2. Development of low level, fundamental pieces of the application (bottom development)

In top development the first thing you consider is surface level behavior: 
* what needs to be done when program starts
* what functions will it need to call
* what entities will be needed to start doing the thing
* expected contracts
* TDD
* e2e tests
* general design of the system
* etc
Top development is not concerned about what happens beneath, but rather about overall picture and usually does not care what exactly they do and produce.
Thats a suitable place for a "global" store, event bus, god-object, dep injection etc. Things that usually need to be easily interconnected, *never* reused and very often change. Needs to be easily navigatable and read by any maintainer, current or future.
But care needs to be taken, so that "global" things are still somewhat contained in modules, thus incorporating bottom development techniques.
That also may be a good place for locality of behavior and classes (oop style) as well as big api granularity.

Bottom development on the other hand starts from fundamental pieces that will be needed for the problem, building up from that.
Bottom development is concerned only about pieces beneath and usually expects full control over them.
Thats the best place to use composition and functional approaches everywhere where its applicable. Things that are reused *very* often and need to arbitrarily compose, changes very rarely and easy to be replaced with other solution. May not require high level of readability, but should have robust logging for debug and good performance.
That also may be good place for separation of concerns, unit tests, as well as small api granularity.

The actual reality is a mix of both on different levels.
The important thing is what makes more sense for a particular type of development.

Libraries are usually expected to give basics that are frequently reused, so bottom development is the best approach.
Frameworks and application code is usually expected to change radically, so a top development is more suitable.

classes provide a mix of pure functional style, which can be considered maximally composable, and top development techniques that allow for implicit state.