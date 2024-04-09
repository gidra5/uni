variables store values
variable is a pair of getter and setter for its value associated with some symbol, the same as the reference to its value
reference to a variable returns that pair as a value
dereference on assignment's left side calls setter of the reference
dereference in other places calls getter of the reference
declarations take a symbol and a reference and creates a variable in current scope
variable's value is got through its symbol - get reference associated with that symbol, call the getter
variable's value is assigned through its symbol - get reference associated with that symbol, call the setter

