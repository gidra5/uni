import { describe, it, test } from 'vitest';

describe('ts algebraic effects parity TODOs', () => {
  describe('operational semantics', () => {
    it.todo('reduces do-context when the bound computation steps');
    it.todo('reduces with-context when the handled computation steps');
    it.todo('reduces do-return by substitution');
    it.todo('reduces do-op by pushing the bind into the continuation');
    it.todo('reduces if true then c1 else c2 to c1');
    it.todo('reduces if false then c1 else c2 to c2');
    it.todo('reduces function application by beta-reduction');
    it.todo('reduces handling return through the return clause');
    it.todo('reduces handled operations through matching handler clauses');
    it.todo('forwards unhandled operations while preserving handling context');
  });

  describe('term equivalences', () => {
    it.todo('algebraic operation commutes with substitution');
    it.todo('(1) do x <- return v in c === c[v/x]');
    it.todo('(2) do x <- op(v; y.c1) in c2 === op(v; y. do x <- c1 in c2)');
    it.todo('(3) do x <- c in return x === c');
    it.todo('(4) associativity of sequencing');
    it.todo('(5) if true then c1 else c2 === c1');
    it.todo('(6) if false then c1 else c2 === c2');
    it.todo('(7) if v then c[true/x] else c[false/x] === c[v/x]');
    it.todo('(8) (fun x -> c) v === c[v/x]');
    it.todo('(9) fun x -> v x === v (checked extensionally on application)');
    it.todo('(10) with h handle (return v) === cr[v/x]');
    it.todo('(11) with h handle op_i(v; y.c) === c_i[v/x, (fun y -> with h handle c)/k]');
    it.todo('(12) with h handle op(v; y.c) === op(v; y. with h handle c) for unknown op');
    it.todo('(13) with (handler {return x -> c2}) handle c1 === do x <- c1 in c2');
  });

  describe('properties', () => {
    test.todo('agreement generator spans the full algebraic-effects core');
    test.todo(
      'vm execution agrees with reduction for translated algebraic-effects core terms'
    );
  });
});
