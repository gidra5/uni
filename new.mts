type SeparatorDef = { 
  tokens: string[], 
  repeat: [from: number, to: number] 
};
type OperatorDef = SeparatorDef[]
type OperatorDefs = Record<string, OperatorDef>;

const parseNext = (src: string, i: number, token: string) => {
  if (src.slice(i, token.length) === token) return i + token.length;
  return i;
}

const parseUntil = (src: string, i: number, tokens: string[], parse: (src: string, i: number) => number) => {
  let index = i;
 
  while (src.charAt(index)) { 
    for (const [i, token] of enumerate(tokens)) {
      const nextIndex = parseNext(src, index, token);
      if (nextIndex !== index) {
        return [nextIndex, i];
      }
    }
    index = parse(src, index); 
  }
  return [i, null];
}

const terminalTokens = (operator: OperatorDef) => {
  const tokens = [];
  
  for (const sep of operator) {
    tokens.push(sep.tokens);
    if (sep.repeat[0] > 0) return tokens;
  }
  return tokens;
}

const parseOperator = (operator: OperatorDef, src: string, i:number) => {
  let index = i;
  let values = [];
  let separators = operator;
  
  while (src.charAt(index)) {
    const sepValues = [];
    const [i, sepIndex] = parseUntil(
      src, 
      index, 
      terminalTokens(separators), 
      (src, i) => {
        const parsedOp = parseOperators(operator.scope, src, i);
        if (parseOp[0] !== i) {
          sepValues.push(parsedOp[1]);
          return parseOp[0];
        }
        sepValues.push(src[i]);
        return i + 1;
      }
    );
    
    values.push(sepValues);
    if (sepIndex > 0) values.push(...repeat([], sepIndex));
    separators = separators.slice(sepIndex+1);
  }
 
}

const parseOperators = (operators: OperatorDefs, src: string, i:number) => {
  for (const operator in operators) {
    const parsed = parseOperator(operators[operator], src, i);
    if (parsed[0] !== i) return [...parsed, operator];
  }
  return [i, null];
}