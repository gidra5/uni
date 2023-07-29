Source: https://refactoring.guru/design-patterns

## Creational patterns

These patterns provide various object creation mechanisms, which increase flexibility and reuse of existing code.

#### Factory Method

**Factory Method** is a creational design pattern that provides an interface for creating objects in a superclass, but allows subclasses to alter the type of objects that will be created.

#### Abstract Factory

**Abstract Factory** is a creational design pattern that lets you produce families of related objects without specifying their concrete classes.

#### Builder

**Builder** is a creational design pattern that lets you construct complex objects step by step. The pattern allows you to produce different types and representations of an object using the same construction code.

#### Prototype

Also known as: Clone

**Prototype** is a creational design pattern that lets you copy existing objects without making your code dependent on their classes.

#### Singleton

**Singleton** is a creational design pattern that lets you ensure that a class has only one instance, while providing a global access point to this instance.

## Structural patterns

These patterns explain how to assemble objects and classes into larger structures while keeping these structures flexible and efficient.

#### Adapter

Also known as: Wrapper

**Adapter** is a structural design pattern that allows objects with incompatible interfaces to collaborate.

#### Bridge

**Bridge** is a structural design pattern that lets you split a large class or a set of closely related classes into two separate hierarchies—abstraction and implementation—which can be developed independently of each other.

#### Composite

Also known as: Object Tree

**Composite** is a structural design pattern that lets you compose objects into tree structures and then work with these structures as if they were individual objects.

#### Decorator

Also known as: Wrapper

**Decorator** is a structural design pattern that lets you attach new behaviors to objects by placing these objects inside special wrapper objects that contain the behaviors.

#### Facade

**Facade** is a structural design pattern that provides a simplified interface to a library, a framework, or any other complex set of classes.

#### Flyweight

Also known as: Cache

**Flyweight** is a structural design pattern that lets you fit more objects into the available amount of RAM by sharing common parts of state between multiple objects instead of keeping all of the data in each object.

#### Proxy

**Proxy** is a structural design pattern that lets you provide a substitute or placeholder for another object. A proxy controls access to the original object, allowing you to perform something either before or after the request gets through to the original object.

## Behavioral patterns

These patterns are concerned with algorithms and the assignment of responsibilities between objects.

In language design they can be implemented as syntactic constructs. 

#### Strategy

**Strategy** is a behavioral design pattern that lets you define a family of algorithms, put each of them into a separate class, and make their objects interchangeable.

#### State

**State** is a behavioral design pattern that lets an object alter its behavior when its internal state changes. It appears as if the object changed its class.

Represent implementation of an finite state machine.

The State pattern suggests that you create new classes for all possible states of an object and extract all state-specific behaviors into these classes.

Instead of implementing all behaviors on its own, the original object, called _context_, stores a reference to one of the state objects that represents its current state, and delegates all the state-related work to that object.

To transition the context into another state, replace the active state object with another object that represents that new state. This is possible only if all state classes follow the same interface and the context itself works with these objects through that interface.

#### Template Method

**Template Method** is a behavioral design pattern that defines the skeleton of an algorithm in the superclass but lets subclasses override specific steps of the algorithm without changing its structure.

#### Visitor

**Visitor** is a behavioral design pattern that lets you separate algorithms from the objects on which they operate.

#### Observer

Also known as: Event-Subscriber, Listener

**Observer** is a behavioral design pattern that lets you define a subscription mechanism to notify multiple objects about any events that happen to the object they’re observing.

Language feature: built in streams and signals.

#### Memento

Also known as: Snapshot

**Memento** is a behavioral design pattern that lets you save and restore the previous state of an object without revealing the details of its implementation.

#### Mediator

Also known as: Intermediary, Controller

**Mediator** is a behavioral design pattern that lets you reduce chaotic dependencies between objects. The pattern restricts direct communications between the objects and forces them to collaborate only via a mediator object.

#### Iterator

**Iterator** is a behavioral design pattern that lets you traverse elements of a collection without exposing its underlying representation (list, stack, tree, etc.).

Language feature: built in iterator interface for for-loops.

#### Command

Also known as: Action, Transaction

**Command** is a behavioral design pattern that turns a request into a stand-alone object that contains all information about the request. This transformation lets you pass requests as a method arguments, delay or queue a request’s execution, and support undoable operations.

#### Chain of Responsibility

Also known as: CoR, Chain of Command

**Chain of Responsibility** is a behavioral design pattern that lets you pass requests along a chain of handlers. Upon receiving a request, each handler decides either to process the request or to pass it to the next handler in the chain.

Language feature: piping functions that return Result monad.

