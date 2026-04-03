import { bench, describe } from 'vitest';
import { parseTokens } from '../src/tokens.js';

const sampleProgram = `
print "Hello, World!"
x := 1, 2, 3
if x[0] == 1 {
  print x[1]
} else {
  print "fallback"
}
`;

describe('tokens benchmark', () => {
  bench('parseTokens sample program', () => {
    parseTokens(sampleProgram);
  });
});
