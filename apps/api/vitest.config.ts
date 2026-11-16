import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/testing/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // ficheiros sem lógica: declarações para o TypeORM/Nest, arranque, migrações e ajudantes dos testes
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.entity.ts',
        'src/**/*.module.ts',
        'src/migrations/**',
        'src/scripts/**',
        'src/testing/**',
        'src/main.ts',
        'src/data-source.ts',
      ],
      reporter: ['text-summary', 'text', 'html'],
      // mínimo obrigatório: se a cobertura descer abaixo disto, `pnpm test:cov` falha
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
