import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      lines: 100,
      statements: 100,
      functions: 100,
      branches: 100,
    },
  },
});
