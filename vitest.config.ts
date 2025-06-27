import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],

    exclude: ['node_modules', 'dist', 'build', '*.config.*'],

    globals: true,

    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.d.ts', 'src/**/index.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    testTimeout: 10000,
    hookTimeout: 10000,

    watch: false,

    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  // Path resolution configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
