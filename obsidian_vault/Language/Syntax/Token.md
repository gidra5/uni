Tokenizer matches the following grammars:
1. `newline = "\s"* "\n" "\s"*`
2. `number_digits = "\d" ("\d" | "_")*`
3. `number = number_digits "\."? number_digits? | number_digits? "\." number_digits`
4. `string = "\"" (~("\\" | "\"") | "\\(" computation ")")* "\""`
5. `placeholder = "_"+`
6. `error` - tokens for incomplete tokens (like unclosed string token)
7. `skip = \s+`
8. `identifier = alphanumeric | special | symbolic`
9. `alphanumeric = ("\w" | "_")+`
10. `special` - predefined list of multi-character symbols (dynamic)
11. `symbolic` - any other character, that doesn't fall into other types.

`token = newline | number | string | placeholder | error | identifier`

It can be easily implemented with regular expressions, except strings and error tokens.