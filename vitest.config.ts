import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // model/ holds the money maths and the status rules — that is what must be covered.
      include: ['src/modules/*/model/**/*.ts', 'src/common/utils/**/*.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { alias: { '@': new URL('./src/', import.meta.url).pathname } },
});
