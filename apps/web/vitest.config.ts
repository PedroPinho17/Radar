import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // o tsconfig do Next usa "jsx: preserve"; nos testes o JSX é compilado já
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      // lógica pura do site; os ecrãs são cobertos pelos testes de ponta a ponta (e2e/)
      include: ['lib/**/*.ts'],
      exclude: ['lib/types.ts', 'lib/utils.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
