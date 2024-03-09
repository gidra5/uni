# Uni - make everything possible the best way possible
A general-purpose multi-paradigm language, that aims to provide scripting-like syntax, versatile std library and typing capabilities, great tooling, cross-platforming, interop with other languages, a native performance of compiled languages.

While there are many great programming languages out in the wild, all of them feel like there is something missing, but otherwise best in class. Maybe its type system, maybe its pattern matching, or first class functions, etc. The goal of this project is to combine ideas from popular languages, ideas from papers on programming, that are either implemented exclusively by maths people for maths people, or just not supported by most mainstream languages

## Main principles
* Everything is an expression.
* First class types (dependent types) - a type can be used as a value
* Customizable - write your own DSL with custom operators or inject custom behavior into language constructs
* Small enough core, so that it can be implemented in multiple languages easily
* Support for multiple types of environments such as virtual machine, compiled binary, interpreter, repl
* Zero annotation precise type inference
* Minimal runtime for compiled output (aka "Zero-cost abstractions")
* Concise, yet granular, APIs
* "Revealing complexity" language design - does not overload with syntax

## Quick Start
To install and run do the following:
```
git clone git@github.com:gidra5/uni.git
cd uni/ts
npm i
npm run build
node ./build/index.js <file>
```

## Usage

To write your first script create a text file and paste in:
```
print "Hello world!"
```
Then pass it to the interpreter to run:
```
node ./build/index.js run *file*
```
Build into a binary and run it in vm: 
```
node ./build/index.js build *file* *image*
node ./build/index.js vm *image*
```
Or start REPL, optionally executing the script before entering: 
```
node ./build/index.js repl *file*
```
Any of those is expected to eventually print `Hello world`

### Basic syntax
Syntax is a mix of functional and C-like syntax, so if you are coming from one of such languages (rust, haskell, js) it may look familiar in some places

* Line comments `// comment`
* Block comments `/* nested /* block */ comment */`
* Values
  * Strings `"string"`
  * Ints `1234`
  * Floats `1.2`
  * Symbols `symbol`
  * Atoms `:atom`
* Mutable variable `mut x := 1`
* Immutable variable `x := 1`
* Assignment `x = 2`
* Arithmetic `1 + 2 * 3^4 / 5 - 6 % 7`
  * Add, sub, mult, div `1 + 2 * 3 / 5 - 6`
  * Power `2 ^ 8`
  * Modulo `28 % 12`
  * Increment decrement `++x, --x`
  * Post increment decrement `x++, x--`
* Boolean logic
  * Boolean `and` and `or` `x and y or z`
  * Comparison `x < 3 or x > 2 or x <= 4 or x >= 6`
  * Equality `x == 1 and x != 2`
  * Deep Equality `x === 1, 2 and x !== 2, 4`
* Parenthesis `1 + (2 + 3) * 4`
* Data structures
  * Tuple `1, 2`
  * Record `first: 1, second: 2`
  * Dictionary `"a": 1, "b": 2`
  * Mixing `1, field: 2, "entry": 3`
  * Access `x[0], x.field, x["entry"]`
* Loops
  * For loop `for x in y: print x`
  * While loop `while x != 0: x--`
  * Loop `loop: print "infinity and beyond"`
  * Break loops `loop: if x == 0: break else x = x + 1`
  * Continue loops `loop { if x != 0 { print "in loop branch"; continue }; print "not in branch loop" }`
* Branches
  * If branching `if x != 0 { print "in branch" }`
  * If else branching `if x != 0 { print "in branch" } else { print "in else branch" }`
  * Match `match x { 1 -> print "x is 1", 2 -> print "x is 2", _ -> print "x is not 1 or 2" }`
* Code blocks
  * Block `y := { x:= 1; x + 1 }; print "x is not visible here"`
  * Break from block `y := { break 1; print "not printed" }`
  * Label code `labeled: { x:= { labeled.break 1; print "not printed" }; print "not printed as well"; x }`
* Functions
  * Function literal `fn x -> x+1`
  * Arrow function `x -> x + 1`
  * Function literal without binding name `fn -> #0 + 1`
  * Function call `x 1`
  * Function call placeholders `f x _ 1`
  * Using shadowed names `fn x -> fn x -> #x + x`

While that is not a full syntax, it is more than enough to scripting stuff

## Documentation
There is a chaotic documentation managed inside obsidian vault. While the desktop app is mostly used to write it, its not expected to be used that way by anyone else, but will provide richer experience if it is. To get a tour of `uni` you can start at `obsidian_vault/Getting started` folder

## Contribution

To install and run do the following:
```
git clone git@github.com:gidra5/uni.git
cd uni/ts
npm i
npm run build
node ./build/index.js <file>
```

If your feature is suitable for TDD, to start adding functionality you can create test file in `tests` and starting `vitest`
Otherwise run `tsc --watch` in background, add cmd command to test whatever you want to test, and run the script whenever you are ready.

## Whatever

While I understand scale of this project is absurd for one man, it is still planned to be developed layer by layer. Most of the goals stated in description are a looong way from being done, especially that im not a pro, that made a bunch of such languages and knows how to do it all, but they will always be the focus of development.
Quick start section especially needs more care, since it is too verbose, it must be one-liner (except the actual usage part)