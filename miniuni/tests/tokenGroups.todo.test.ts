import { describe, test } from 'vitest';

const compact = (input: string) => input.replace(/\s+/g, ' ').trim();

describe('ts token group parity TODOs', () => {
  describe('pair groups', () => {
    test.todo(`parens :: ${compact('(x)')}`);
    test.todo(`brackets :: ${compact('[x]')}`);
    test.todo(`braces :: ${compact('{x}')}`);
    test.todo(`braces newlines :: ${compact('{\nx\ny\n}')}`);
    test.todo(`missing block end :: ${compact('{')}`);
    test.todo(`missing block start :: ${compact('}')}`);
    test.todo(`missing block start inside block :: ${compact('{}}')}`);
    test.todo(`missing block end inside block :: ${compact('{{}')}`);
    test.todo(`unclosed inside parens :: ${compact('({)')}`);
    test.todo(`missing block start inside parens :: ${compact('(})')}`);
    test.todo(
      `missing block start inside block inside parens :: ${compact('({}})')}`
    );
    test.todo(
      `missing block end inside block inside parens :: ${compact('({{})')}`
    );
  });

  describe('for group', () => {
    test.todo(`for colon :: ${compact('for x in y: z')}`);
    test.todo(`for arrow :: ${compact('for x in y -> z')}`);
    test.todo(`for braces :: ${compact('for x in y { z }')}`);
    test.todo(`for block missing block end :: ${compact('for x in y {')}`);
    test.todo(`for block missing block start :: ${compact('for x in y }')}`);
    test.todo(`for block missing in y :: ${compact('for x { z }')}`);
    test.todo(
      `for missing closing token or block :: ${compact('for x in y')}`
    );
    test.todo(`for colon missing in y :: ${compact('for x : z')}`);
    test.todo(`for arrow missing in y :: ${compact('for x -> z')}`);
    test.todo(
      `for missing in y and block start :: ${compact('for x }')}`
    );
    test.todo(`for missing in y and block end :: ${compact('for x {')}`);
    test.todo(
      `for missing in y and block start inside block :: ${compact(
        '{ for x } }'
      )}`
    );
    test.todo(`for missing everything :: ${compact('for x')}`);
  });

  describe('while group', () => {
    test.todo(`while colon :: ${compact('while x: z')}`);
    test.todo(`while arrow :: ${compact('while x -> z')}`);
    test.todo(`while braces :: ${compact('while x { z }')}`);
    test.todo(
      `while block missing block end :: ${compact('while x {')}`
    );
    test.todo(
      `while block missing block start :: ${compact('while x }')}`
    );
    test.todo(
      `while missing closing token or block :: ${compact('while x')}`
    );
    test.todo(
      `while missing block start inside block :: ${compact('{ while x } }')}`
    );
  });

  describe('match group', () => {
    test.todo(`match :: ${compact('match x { a -> b }')}`);
    test.todo(`match missing block start :: ${compact('match x }')}`);
    test.todo(`match missing block end :: ${compact('match x {')}`);
    test.todo(
      `match missing block start inside block :: ${compact('{ match x } }')}`
    );
    test.todo(`match missing everything :: ${compact('match x')}`);
  });

  test.todo(`template strings :: ${compact('"text \\(expr)"')}`);
  test.todo(`parseTokens :: ${compact('42 "Hello" variable ((expr))')}`);
  test.todo('parseTokenGroups never throws');
  test.todo('parseTokenGroups positions are correctly nested');
});
