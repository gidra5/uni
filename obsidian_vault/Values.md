variables store values
reference to a value is a pair of getter and setter
variable is a reference for its value associated with some symbol
reference to a variable returns that reference
dereference on assignment's left side calls setter of the reference
dereference in other places calls getter of the reference
declarations take a symbol and a reference and creates a variable in current scope
variable's value is got through its symbol - get reference associated with that symbol, call the getter
variable's value is assigned through its symbol - get reference associated with that symbol, call the setter

assignment's and definition's lhs is transformed into atom if its just a name, or evaluates to a symbol
tranaformantion should happen at evaluation phase, because translated tree would contain names as well, which will create inf loop
`~symbol = value ->  *current_scope[symbol] = value`
`~symbol -> *current_scope[symbol]`
`~symbol := value -> &~symbol := &value`
`&~symbol := ref -> current_scope[symbol] = ref`
`*ref = value -> ref[setter] value`
`*ref -> ref[getter] ()`
`record.name = value ->  *record[:name] = value`
`record.name -> *record[:name]`
