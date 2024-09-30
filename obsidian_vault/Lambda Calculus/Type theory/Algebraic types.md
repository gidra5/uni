
Basic algebraic types:
1. *Function* type with `fn name: type -> type` or `type -> type`
2. *Tagged union* type with `union` operator applied to record (for names variants) or tuple (for indexed variants)
3. *Tuple* types with `type, ...`
4. *Record* types with `label: type, ...`
6. *Unit* type with `()`. A record without any fields
7. *Void* type with `void = union ()`. A union without any variants

Operators:
1. *Join* tuples and records, or extend unions `...tuple1, ...tuple2`
2. *Index* tuples or unions `a[k]` or `a.label` is the type of an element at given index.

Relations:
1. `a[k] = void` if `k` is not a label or index present on `a`
2. `a[union k] = union a[k.n]`


Subtyping relation `<=` is defined:

1. `a <= b` if `a[k] <= b[k]` for all `k: keyof a or keyof b`, where `a` and `b` are tuples or records
2. `union a <= union b` if `a[k] <= b[k]` for all `k: keyof a and keyof b`

https://www.reddit.com/r/ProgrammingLanguages/s/1D3rV7YQVo