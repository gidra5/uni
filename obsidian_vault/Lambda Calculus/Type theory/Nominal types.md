Types that are postulated to be distinct from any other type. Usually has and "underlying representation"


Nominal types useful to describe "measures" - they are described by the same underlying type (`number`), but carry different semantics (`cm != mm`). By making them nominal, we can then define particular behavior to them, like conversion between measures (`1 cm => 10 mm`).
That may as well be used for library developers, that may use the same terminology as others (`Request` in `http` module and `Request` in `websocket` module mean different things and should not be mixed, probably, even if they happen to have the same structure), but mean different thing by it. It can be views as means to distinguish between synonyms and ambiguous values
