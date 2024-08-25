When parser realizes that input has invalid structure there are two ways to handle it:
1. Insert expected tokens, continue as if they were in the input
2. Discard tokens that come next, until we meet expected next token

First case makes sense when some structure *must* be at the current position, for example if we encounter prefix operator and then postfix right after. Neither of them can be without an operand, and it *must* be before postfix but after prefix. Thus we insert a node of expected type, a kind of placeholder value.

Second case makes sense when some token was expected to appear by that point, but didn't. For example if inside parentheses expression was not immediately followed by a closing parentheses. That may just indicate some typo inside the expression, and assuming parentheses are balanced, we discard any following tokens until we find closing parentheses. Another example related to balanced tokens, is the case when unexpected closing token was encountered - in that case it only makes sense to discard illegal token and continue as if it wasn't there.