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
transformation should happen at evaluation phase, because translated tree would contain names as well, which will create inf loop

there must be defined 5 operations:
1. creating fresh reference
2. binding reference to a symbol
3. get reference that is bound to a symbol
4. get value of reference
5. set value of reference

in current scope:
`&[symbol] = ref` - bind reference to the symbol (declare a symbol)
`&[symbol]` - get reference bound to the symbol
`*ref = value` - set value of the reference
`*ref` - get value of the reference
`[get]: fn -> value, [set]: fn value -> _` - reference interface

common operations in current scope:
`[symbol] = value -> *&[symbol] = value` - set value of the reference that the symbol is bound to
`[symbol] -> *&[symbol]` - get value of the reference that the symbol is bound to
`[symbol] := value -> &[symbol] = ref; *&[symbol] = value` - create reference, set its value, and bind it to the symbol
`name -> [:name]` - get value of a name
`record.name -> *&record[:name]` - get value of a name in `record`
`record[symbol] -> *&record[symbol]` - get value of a symbol in `record`
`name = value -> *&[:name] = value`
`record.name = value -> *&record[:name] = value`
`record[symbol] = value -> *&record[symbol] = value`


Настало время мне компилить как-то типы данных.
И начал я с "символов" - уникальные значения, равные только самим себе. Очень полезная штука, что бы избегать коллизий с другими значениями и что бы можно было манипулировать самими именами. Дополнительно можно дать им имена, что бы во время вывода было чуть дескриптивнее, но помимо этого они это имя никак не влияет на сам символ.

В контексте компиляции это по сути значит, что значение должно иметь тип символа, и что его значение должно соответствовать одному из возможных символов. Множество возможных символов собирается во время компиляции. Каждому присваивается уникальная айдишка и имя (предоставленное, или сгенерированное). Полезно иметь детерменированные айдишки
...

https://stackoverflow.com/questions/71811886/ultra-fast-lookup-in-small-sized-container-of-64-bit-integer-values-using-dynami