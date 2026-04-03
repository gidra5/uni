export const isVitestSnapshotUpdateEnabled = () => {
  const worker = (globalThis as any).__vitest_worker__;
  return worker?.config?.snapshotOptions?.updateSnapshot === 'all';
};

if (import.meta.vitest) {
  const { describe, expect, test } = import.meta.vitest;

  describe('vitest snapshot update mode', () => {
    test('detects update mode from vitest worker state', () => {
      const previous = (globalThis as any).__vitest_worker__;

      try {
        (globalThis as any).__vitest_worker__ = {
          config: {
            snapshotOptions: {
              updateSnapshot: 'all',
            },
          },
        };

        expect(isVitestSnapshotUpdateEnabled()).toBe(true);

        (globalThis as any).__vitest_worker__ = {
          config: {
            snapshotOptions: {
              updateSnapshot: 'new',
            },
          },
        };

        expect(isVitestSnapshotUpdateEnabled()).toBe(false);
      } finally {
        (globalThis as any).__vitest_worker__ = previous;
      }
    });
  });
}
