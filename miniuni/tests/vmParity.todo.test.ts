import { describe, it } from 'vitest';

describe('ts vm parity TODOs', () => {
  describe('properties', () => {
    it.todo('script codegen never throws');
    it.todo('script execution never throws');
  });

  describe('scope', () => {
    it.todo('block shadowing');
    it.todo('loop shadowing');
    it.todo('fn concurrent');
    it.todo('while block shadowing');
    it.todo('for block shadowing');
    it.todo('block assign');
    it.todo('block increment');
    it.todo('declaration shadowing and closures');
    it.todo('and rhs creates scope');
    it.todo('or rhs creates scope');
    it.todo('is binds in local expression scope');
  });

  describe('values and syntax', () => {
    it.todo('string template');
    it.todo('true');
    it.todo('false');
    it.todo('atom');
    it.todo('matches record pattern');
    it.todo('matches record pattern with rename');
    it.todo('matches tuple pattern');
    it.todo('matches rest pattern');
    it.todo('matches defaulted pattern');
    it.todo('function with shadowed name access');
    it.todo('function with deep shadowed name access');
    it.todo('iife id');
    it.todo('function with no arg');
    it.todo('fn no parameters');
    it.todo('fn increment 2');
    it.todo('delimited application');
  });

  describe('structured programming', () => {
    it.todo('label loop if-then');
    it.todo('while loop increments until condition');
    it.todo('while loop continue');
    it.todo('while loop break value');
    it.todo('while loop');
    it.todo('for loop filter');
    it.todo('non-strict variable declaration with null');
    it.todo('block variable declaration');
    it.todo('block mutable variable declaration');
    it.todo('block variable assignment');
    it.todo('dynamic variable name');
  });

  describe('error handling and resources', () => {
    it.todo('try throw');
    it.todo('try');
    it.todo('no try');
    it.todo('? on ok result');
    it.todo('try unwrap ok result');
    it.todo('? on error result');
    it.todo('try unwrap error result');
    it.todo('unwrap inside on ok result');
    it.todo('unwrap inside on error result');
    it.todo('resource handling rest');
    it.todo('resource handling block');
    it.todo('resource handling do');
  });

  describe('data structures', () => {
    it.todo('set literal');
    it.todo('multiset literal');
    it.todo('field access');
    it.todo('field access dynamic');
    it.todo('field assignment');
    it.todo('unit literal');
    it.todo('dictionary without braces');
    it.todo('channel');
  });

  describe('null semantics', () => {
    it.todo('prints warning on evaluating to null anything');
    it.todo('no warning on evaluating to null when explicit');
    it.todo('no warning on evaluating to null when explicit 2');
    it.todo('error on evaluating to null when given "strict" vm flag');
  });

  describe('symbols and heap memory', () => {
    it.todo('creates a named symbol');
    it.todo('atoms equality is by name');
    it.todo('symbol equality is by identity');
    it.todo('alloc stores value and returns pointer');
    it.todo('free removes stored value');
    it.todo('pointer read');
    it.todo('pointer write');
    it.todo('ref value');
    it.todo('ref write');
  });

  describe('concurrency', () => {
    it.todo('channel send receive');
    it.todo('channel structured');
    it.todo('parallel composition async');
    it.todo('nondet process sum');
    it.todo('replication');
    it.todo('null process');
    it.todo('parallel composition vector');
    it.todo('simd semantics');
    it.todo('parallel composition multiset');
    it.todo('collect parallel vector');
    it.todo('collect nondet sum');
    it.todo('vectorize multiset');
    it.todo('race vector');
    it.todo('race multiset');
    it.todo('fn multiset');
    it.todo('await multiset');
    it.todo('await vector');
    it.todo('await nondet');
    it.todo('await async');
    it.todo('select channels');
    it.todo('wait');
    it.todo('force sync');
    it.todo('event emitter');
    it.todo('chan collect to list');
    it.todo('all in one');
  });

  describe('effect handlers', () => {
    it.todo('inject');
    it.todo('mask');
    it.todo('mask 2');
    it.todo('without');
    it.todo('inject shadowing');
    it.todo('parallel inside');
    it.todo('handler with continuation');
    it.todo('agrees with algebraic-effects reduction on a semantically equivalent program');
    it.todo('block-inject-fn-handle twice');
    it.todo('block-inject-fn-handle');
    it.todo('no continuation calls sequential');
    it.todo('no continuation calls');
    it.todo('handler return aborts block');
    it.todo('handler return aborts after continuation');
    it.todo('single continuation call');
    it.todo('multiple continuation calls');
    it.todo('multiple continuation calls with mutations and refs');
    it.todo('multiple continuation calls with mutations and closure');
    it.todo('multiple continuation calls with mutations');
    it.todo('multiple continuation calls with inner mutation');
    it.todo('multi-level state backtracking');
    it.todo('disjoint-level state backtracking');
    it.todo('choose int loop');
    it.todo('unhandled fail');
    it.todo('choose int recursion');
    it.todo('pythagorean triple example');
    it.todo('logger example');
    it.todo('transaction example');
  });

  describe('modules and advanced runtime', () => {
    it.todo('import declaration');
    it.todo('import project absolute');
    it.todo('import project relative');
    it.todo('import project root');
    it.todo('import project file');
    it.todo('import with external');
    it.todo('import script');
    it.todo('import interop with other language');
    it.todo('dynamic import');
    it.todo('modules import as singletons');
    it.todo('private declaration');
    it.todo('export declaration');
    it.todo('export default');
    it.todo('external declaration');
    it.todo('namespace');
    it.todo('operator declaration');
  });
});
