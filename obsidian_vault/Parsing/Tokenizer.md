There are several types of tokens:
1. `newline` - any whitespace sequence that contains newline symbol
2. `number` - sequence of digits with one optional separating dot and inner underscores for separating digits.
3. `string` - a sequence of any characters enclosed between doublequotes. Has special symbol to escape doublequotes and do interpolation.
4. `identifier` - sequence of characters, can be of these types:
    1. `alphanumeric` - sequence of alphanumerics and underscore
    2. `special` - sequence of characters that matches predefined list of special tokens. Usually symbolic tokens that are longer that one character
    3. `symbolic` - anything else, that doesn't fall into other types.

Every token follows maximal munch principle - keep consuming, appending to the current token, until encounter unexpected character, which means start of new token.

Or put it another way - when two lexical grammar rules can both match a chunk of code that the scanner is looking at, _whichever one matches the most characters wins_.[^1]

Any sequence of whitespace that doesn't include newline is ignored.

There are no possible errors during tokenization.

[^1]: https://craftinginterpreters.com/scanning.html