/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      reportsDirectory: 'test-results/coverage',
      reporter: ['text', 'html', 'json-summary'],
      reportOnFailure: true,
    },
    benchmark: {
      include: ['bench/**/*.bench.ts'],
      reporters: ['default'],
      outputJson: 'test-results/bench/benchmark.json',
    },
  },
});
