import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/rules/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/domain/rules.ts'],
      thresholds: { lines: 95, branches: 90, functions: 100, statements: 95 },
    },
  },
});
