type SeparatorDef = { tokens: string[], repeat: [from: number, to: number] };
type OperatorDef = SeparatorDef[]
type OperatorDefs = Record<string, OperatorDef>;

const parseNext = (src: string, i: number, token: string) => {
  if (src.slice(i, token.length) === token) return i + token.length;
  return i;
}

const parseUntil = (src: string, i: number, tokens: string[]) => {
  let index = i;
 
  while (src.charAt(index)) { 
    for (const i = 0; i
  }
}

const parseOperators = (operators: OperatorDefs, source: string) => {
  let index = 0;
 
 
}