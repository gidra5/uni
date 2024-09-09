There are several types of tokens:
1. `newline` - any whitespace sequence that contains newline symbol
2. `number` - sequence of digits with one optional separating dot and inner underscores for separating digits.
3. `string` - a sequence of any characters enclosed between doublequotes. Has special symbol to escape some sequences.
4. `placeholder` - a special token to represent explicit placeholders in code, written as one or more underscores.
5. `error` - a special token to represent an tokenization error in code, placed instead of the other types of tokens.
6. `skip` - a "token" that is skipped out of stream.
7. `identifier` - sequence of characters, can be of these types:
    1. `alphanumeric` - sequence of alphanumeric characters and underscores
    2. `special` - sequence of characters that matches predefined list of special tokens. Usually symbolic tokens that are longer that one character. May be extended by parser to handle custom operators.
    3. `symbolic` - anything else, that doesn't fall into other types.

Any other kind of tokens can be reduced to a list above.

Every token follows maximal munch principle - keep consuming, appending to the current token, until encounter unexpected character, which means start of new token.

Or put it another way - when two lexical grammar rules can both match a chunk of code that the scanner is looking at, _whichever one matches the most characters wins_.[^1]

[^1]: https://craftinginterpreters.com/scanning.html