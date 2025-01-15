
Basic algebraic types:
1. Tagged union type with `union` applied to record or tuple
2. Untagged union with `or`
3. Tuple types with `(type, ...)`
4. Record types with `record { label: type, ... }`
5. Function types with `fn label: type => <effects> type`
6. Nominal types with `nominal` operator
7. Unit type `()`
8. bottom type `void`. 
9.  top type `unknown`. 
10. indexing `record.name` and `tuple[index]`
11. intersection `and`
12. negation `not`
13. traits `trait`. 

Primitives:
1. `number`
2. `string`
3. `boolean`
4. `symbol`
5. `type i`

Subtyping `<:`:
1. 
