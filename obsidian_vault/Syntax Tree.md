After [[Token Tree]] is generated, we can breadth first parse it into actual syntax tree.

First are parsed all declarations in a module, then interpret declarations to add custom operators to be used inside declaration bodies.

Same strategy applied recursively after one layer is fully processed.

