Generic types are types that are derived from some other unknown type.

Suppose we have an classes like in TypeScript:
```
class Stack<T> {
  T[] array = []
  push(item: T) {
    this.array = [...this.array, item]
  }
  pop() {
    let item
    [...this.array, item] = this.array
    return item
  }
}
```

Generic types correspond to product types, which in turn corresponds to universal quantification in logic.
thus statement like `for all sets x, given y from x, y is an element` can be translated into something like `∀x -> fn y: x -> y`. In TypeScript it is usually written as `<x>(y: x) => y`, and read like "for some type `x`, accept values `y` of type `x` and return `y`"

[strong existentials are inconsistent](https://ecommons.cornell.edu/server/api/core/bitstreams/ba4fbbb2-13ae-4fe9-ad63-10d332170c9f/content)
