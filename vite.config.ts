import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { dependencies } from './package.json';

const nodeBuiltins = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'domain',
  'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode', 'querystring',
  'readline', 'stream', 'string_decoder', 'timers', 'tls', 'tty', 'url', 'util',
  'v8', 'vm', 'zlib', 'async_hooks', 'perf_hooks', 'worker_threads', 'inspector'
];

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
      formats: ['es'], 
      fileName: (format, entryName) => `${entryName}.js`,
    },
    outDir: 'dist',
    target: 'node18',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: [
        ...Object.keys(dependencies),
        ...nodeBuiltins,
        ...nodeBuiltins.map(mod => `node:${mod}`),
        /^node:/,
        /^@modelcontextprotocol\/sdk/,
      ],
      output: {
        format: 'es',
        dynamicImportInCjs: false,
      },
    },
    ssr: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
