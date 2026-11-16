import { globalIgnores } from "eslint/config";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { fileURLToPath } from "node:url";

const resolve = (pkg) => fileURLToPath(import.meta.resolve(pkg));
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // builds e relatórios de testes (código gerado)
    ".next-e2e/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  pluginReactHooks.configs.flat.recommended,
  // Código TypeScript da app (sem isto, o ESLint só olhava para os ficheiros .js de configuração).
  // Usa o parser do Babel da config base (o typescript-eslint ainda não suporta o TypeScript 7).
  {
    // .tsx: JSX ligado explicitamente (o parser do ESLint não diz ao Babel a extensão do ficheiro)
    files: ["**/*.tsx"],
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [resolve("@babel/preset-typescript")],
          plugins: [resolve("@babel/plugin-syntax-jsx")],
        },
      },
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // o "tsc" já verifica nomes indefinidos e variáveis por usar, e entende tipos (estas regras de JS não)
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
    },
  },
  // ficheiros de configuração correm em Node
  {
    files: ["*.config.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
];
