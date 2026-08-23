import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
