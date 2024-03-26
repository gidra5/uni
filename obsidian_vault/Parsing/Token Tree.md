---
aliases: token groups
---

After text is tokenized, they are checked for existence of balanced token groups.

Token groups are defined by delimiters - special tokens that separate one token group from another. There may be multiple separators in one group, which separate different sections of token group.

Token groups may be parsed partially - sometimes we don't know about all possible groups. If new groups added, they cannot restrict what groups are allowed inside, unless we do full reparsing of whatever may be inside.

Rough typing for that is:

```typescript
export type TokenTree = { 
	id: string; 
	type: "group", 
	token: Token; 
	children: TokenTreeDelimiter[] 
} | Token;
export type TokenTreeDelimiter = {
  children: TokenTree[];
  token: Token;
  delimiterIndex: number;
};
export type SeparatorDefinition = {
  tokens: Token[];
  repeats: [min: number, max: number];
  insertIfMissing: boolean;
};
export type TokenGroupDefinition = {
  separators: SeparatorDefinition[];
  leadingTokens: Token[];
};
```

And the algoright is that:
  
1. Match leading separator.
2. if no match - return error
3. While list of separators is not empty, do:
  1. Take a leading sublist of separators that has with non-optional separator at the end
  2. if current token is not available:
    1. reset stream to prev delimiter
    2. if leading delimiter had enough repeats - remove it and go to 3.1
    3. sync stream by "inserting" next required delimiter, if allowed, and continue parsing next delimiter
    4. otherwise sync all other required delimiters and return an error
  3. if current token matches one of delimiters' tokens:
    1. remove all preceding delimiters from list
    2. Add matched delimiter to group's children.
    3. trim newline tokens
    4. If matched delimiter's repeats is below min repeats - go to 3.2.
    5. if matched delimiter's repeats is equal to max repeats - drop matched delimiter as well
    6. go to 3.1
  4. if does not match - try parsing nested groups.
  5. If none of groups match - append current character to the separator's children, then go to 3.2.
  6. Otherwise add parsed group to the delimiter's children
4. return resulting operator
