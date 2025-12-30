https://github.com/ekmett/lens/wiki/Examples
https://hackage.haskell.org/package/lens
https://en.wikipedia.org/wiki/Bidirectional_transformation
https://medium.com/@gcanti/introduction-to-optics-lenses-and-prisms-3230e73bfcfe
https://www.tweag.io/blog/2022-05-05-existential-optics/

https://chatgpt.com/c/6951584e-86c0-8327-a17f-e1e9fdc5e33f

lenses describe access patterns, while datatypes describe layout of the underlying data.
We could make lenses abstracted from the layout, allowing us to change it as we wish during computation. We just need lens implementations for each layout.

Or if we define lenses over some canonical data structures, and use layouts as data types isomorphic to the canonical one, we might even be able to define lenses once for canonical structure and implicitly get lenses for all layouts.