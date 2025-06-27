import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { dependencies, devDependencies } from './package.json';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/__test__/**/*'],
    }),
  ],
  build: {
    lib: {
      entry: {
        'cli/client': resolve(__dirname, './src/cli/client.ts'),
        'cli/server': resolve(__dirname, './src/cli/server.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'esm' : format}.js`,
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        ...(Object.keys(dependencies) ?? []),
        ...(Object.keys(devDependencies) ?? []),
        /^node:/,
        'url',
        'fs',
        'express',
        'async_hooks',
        'path',
        'child_process',
      ],
    },
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});
