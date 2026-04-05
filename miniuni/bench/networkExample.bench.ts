import { beforeEach, bench, describe } from 'vitest';
import { Injectable, register } from '../src/injector.ts';
import { FileMap } from 'codespan-napi';
import { evaluateEntryFile } from '../src/evaluate/index.ts';

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.ASTNodeNextId, 0);
  register(Injectable.ASTNodePrecedenceMap, new Map());
  register(Injectable.ASTNodePositionMap, new Map());
});

describe('network benchmark', () => {
  const sizes = [3, 4, 5];
  const counts = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const workloads = sizes.flatMap((size) =>
    counts.map((count) => [size, count])
  );
  for (const [size, count] of workloads) {
    bench(
      `Network example (${size} size x ${count} count)`,
      async () => {
        await evaluateEntryFile(
          './examples/network.unim',
          [size, count, 0, 0].map(String)
        );
      },
      {
        time: 20,
        iterations: 3,
      }
    );
  }
});
