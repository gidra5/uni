
Basic algebraic types:
1. *Function* type with `fn name: type -> type` or `type -> type`
2. *Tagged union* type with `union` operator applied to record (for names variants) or tuple (for indexed variants)
3. *Tuple* types with `type, ...`
4. *Record* types with `label: type, ...`
5. *Join* tuples and records, or extend unions `...tuple1, ...tuple2`
6. *Unit* type with `()`. Unit wrt joining `...tuple, ...() = tuple`
7. *Void* type with `void = union ()`. Unit wrt extending `...union, ...void = union`
8. `a[k]` is the type of index `k` in tuple or union with indexed variants
9. `a.label` is the type of label `k` in record or union with named variants
10. `a[k] = void` if `k` is not a label or index present on `a`

Subtyping relation `<=` is defined:

1. `a <= b` if `a[k] <= b[k]` for all `k: keyof a or keyof b`, where `a` and `b` are tuples or records
2. `union a <= union b` if `a[k] <= b[k]` for all `k: keyof a and keyof b`