This would be really useful for generators, since they only support one yield type. 
For example:
```typescript
function* genFn() {
  const first: string = yield 1;
  const second: number = yield "next";
  return [first, second]
}

// gen: Generator<number | string, [string, number], undefined | string | number>
const gen = genFn(); 
const firstAnswer = gen.next() as { done: false, value: number };
const secondAnswer = gen.next("first") as { done: false, value: string };
const result = gen.next(2) as { done: true, value: [string, number] };
```

A better typing (pseudocode):
```typescript
function* genFn() {
  const first: string = yield 1;
  const second: number = yield "next";
  return [first, second]
}

/* 
  gen: { 
    next(): number & this is { 
    next(x: string): string & this is { 
    next(x: number): [string, number] & this is { 
    next(x: never): never 
  } } } }
*/
const gen = genFn(); 
const firstAnswer = gen.next(); // { done: false, value: number }
const secondAnswer = gen.next("first"); // { done: false, value: string }
const result = gen.next(2); // { done: true, value: [string, number] }
```

In best case it should allow to type "do-notation" based on generators (example inspired by [this](https://text.marvinborner.de/2024-11-18-00.html)):
```javascript
type Parser<T> = (src: string, i: number) => [index: number, result: T];
// single commutincation - accepts parsers that produce U
// and pass their result as yield value
type ParserDo<T, U> = () => Generator<Parser<U>, T, U>;

// a parser do notation
const _do =
  <T, G extends ParserDo<T, unknown>>(f: G): Parser<T> =>
  (src, i) => {
    const gen = f();
    let value: unknown;

    while (true) {
      const { done, value: v } = gen.next(value);

      if (done) return [i, v];
      [i, value] = v(src, i);
    }
  };

const parseString =
  (str: string): Parser<boolean> =>
  (src, i) => {
    const matches = src.startsWith(str, i);
    const index = matches ? i + str.length : i;
    return [index, matches];
  };

const parseDigit: Parser<number | null> = (src, i) => {
  const char = src.charAt(i);
  if (/\d/.test(char)) return [i + 1, Number(char)];
  return [i, null];
};

const advance: Parser<void> = (src, i) => {
  return [i + 1, void 0];
};

/* 
  T = number | null
  U = { 
    next(): { done: false, value: Parser<boolean> } & this is { 
    next(x: boolean): { done: false, value: Parser<void> } & this is { 
    next(x: void): { done: false, value: Parser<number | null> } & this is { 
    next(x: number | null): ({ done: true, value: null } & this is { 
      next(x: never): never 
    }) | ({ done: false, value: Parser<boolean> } & this is { 
      next(x: boolean): { done: true, value: number } & this is { 
      next(x: never): never 
    } })
   } } } }
*/
const parser = _do(function* () {
  if (yield parseString("Hello")) return;
  yield advance;
  yield advance;
  const digit = yield parseDigit; // digit: number | null
  if (digit === null) return null;
  yield parseString("!");
  return digit;
});

console.log(parser("Hello, 2!", 0)); // [index: 9, result: 2]
```

A general type for generators could then be:
```typescript
type Generator<In=any, Out=any, Rest = Self> = {
  next(x: In): Out & this is Rest
}
```