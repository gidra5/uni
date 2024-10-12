
try using this framework to compute absurdly big numbers, but compromising precision (even more that floats)
https://www.youtube.com/watch?v=MP3pO7Ao88o&list=LL&index=55&t=3s&ab_channel=UnaryPlus

There can be defined a set of operations, that distribute over each other
It begins with familiar `+` and `*`, such that `a*(b+c)===a*b+a*c`
There exists an isomorphism between them, that can be denoted as `exp(x)`
The inverse of `exp(x)` is `log(y)`
Using these two we can define a `^` such that `a^(b*c)===(a^b)^c`
It can be defined as `a^b=exp(log(a)*log(b))`

Floating point numbers are represented as `a*2^b`, where exponentiation is the regular one

```
a*2^b*c*2^d = (a*c)*2^(b+d)
exp(a*2^b)  = 2^(a*2^b)
			= 2^a*2^2^b
			= (2^2^b)*2^a
a*2^b+c*2^d = (a+c)*2^b+c*2^(d-b)
            = log(exp(x + y))
            = log(exp(x)*exp(y))
            = log((2^2^b)*2^a*(2^2^d)*2^c)
            = log(2^(2^b+2^d)*2^(a+c))
```

