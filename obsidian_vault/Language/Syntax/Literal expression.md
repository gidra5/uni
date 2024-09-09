A value literal that describes constant of some type.

`literal = string | number | "true" | "false" | function`
`function = arrow_function | keyword_function`
`arrow_function = pattern "->" computation`
`keyword_function = "fn" pattern ("," pattern)* keyword_function_body`
`keyword_function_body = "->" (computation | type block) | block`