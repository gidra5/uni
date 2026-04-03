import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadRegressionCases,
  saveRegressionCases,
} from '../src/testing/regressionStorage.js';
import {
  runPropertyWithRegressions,
  type PropertyContext,
} from '../src/testing/fastCheck.js';

const withTempRoot = async (
  fn: (root: string, context: PropertyContext) => Promise<void>
) => {
  const root = await mkdtemp(join(tmpdir(), 'miniuni-fast-check-'));
  const context: PropertyContext = {
    regressionRoot: root,
    sourceFile: 'tests/demo.test.ts',
    propertyPath: ['demo property'],
  };

  try {
    await fn(root, context);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('fast-check regression adapter', () => {
  test('persists a newly discovered failing case', async () => {
    await withTempRoot(async (root, context) => {
      const property = fc.asyncProperty(fc.constant(1), async (value) => {
        expect(value).toBe(2);
      });

      await expect(
        runPropertyWithRegressions(property, {
          context,
          params: { seed: 1, numRuns: 1 },
          updateMode: false,
        })
      ).rejects.toThrow(/Property failed after 1 tests/);

      await expect(
        loadRegressionCases(root, context.sourceFile, context.propertyPath)
      ).resolves.toEqual([{ seed: 1, path: '0' }]);
    });
  });

  test('replays stored failures before randomized search and stops on the first replay failure', async () => {
    await withTempRoot(async (root, context) => {
      await saveRegressionCases(root, context.sourceFile, context.propertyPath, [
        { seed: 1, path: '0' },
      ]);

      let calls = 0;
      const property = fc.asyncProperty(fc.integer(), async (value) => {
        calls++;
        expect(value).not.toBe(7);
      });

      await expect(
        runPropertyWithRegressions(property, {
          context,
          params: { examples: [[7]], seed: 123, numRuns: 10 },
          updateMode: false,
        })
      ).rejects.toThrow(/Counterexample: \[7\]/);

      expect(calls).toBe(1);
    });
  });

  test('resumes random search after stored cases pass and appends new failures', async () => {
    await withTempRoot(async (root, context) => {
      await saveRegressionCases(root, context.sourceFile, context.propertyPath, [
        { seed: 1, path: '0' },
      ]);

      let calls = 0;
      const property = fc.asyncProperty(fc.constant(9), async (value) => {
        calls++;
        expect(value).not.toBe(9);
      });

      await expect(
        runPropertyWithRegressions(property, {
          context,
          params: { examples: [[7]], seed: 123, numRuns: 2 },
          updateMode: false,
        })
      ).rejects.toThrow(/Counterexample: \[9\]/);

      expect(calls).toBe(3);
      await expect(
        loadRegressionCases(root, context.sourceFile, context.propertyPath)
      ).resolves.toEqual([
        { seed: 1, path: '0' },
        { seed: 123, path: '1' },
      ]);
    });
  });

  test('deduplicates regression cases with the same seed and path', async () => {
    await withTempRoot(async (root, context) => {
      await saveRegressionCases(root, context.sourceFile, context.propertyPath, [
        { seed: 1, path: '0' },
        { seed: 1, path: '0' },
        { seed: 2, path: '1' },
      ]);

      await expect(
        loadRegressionCases(root, context.sourceFile, context.propertyPath)
      ).resolves.toEqual([
        { seed: 1, path: '0' },
        { seed: 2, path: '1' },
      ]);
    });
  });

  test('vitest update mode rewrites failing regressions and deletes stale ones once they pass', async () => {
    await withTempRoot(async (root, context) => {
      await saveRegressionCases(root, context.sourceFile, context.propertyPath, [
        { seed: 1, path: '0' },
        { seed: 1, path: '1' },
      ]);

      const filePath = join(root, 'tests', 'demo.test.ts.json');

      const stillFailing = fc.asyncProperty(fc.integer(), async (value) => {
        expect(value).not.toBe(8);
      });

      await expect(
        runPropertyWithRegressions(stillFailing, {
          context,
          params: { examples: [[7], [8]], seed: 123, numRuns: 10 },
          updateMode: true,
        })
      ).rejects.toThrow(/Counterexample: \[8\]/);

      await expect(
        loadRegressionCases(root, context.sourceFile, context.propertyPath)
      ).resolves.toEqual([{ seed: 1, path: '1' }]);

      const nowPassing = fc.asyncProperty(fc.integer(), async () => {});

      await expect(
        runPropertyWithRegressions(nowPassing, {
          context,
          params: { examples: [[7], [8]], seed: 123, numRuns: 10 },
          updateMode: true,
        })
      ).resolves.toBeUndefined();

      await expect(access(filePath)).rejects.toThrow();
    });
  });
});
