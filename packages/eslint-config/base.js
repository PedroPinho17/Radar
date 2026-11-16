import babelParser from "@babel/eslint-parser";
// importado aqui (e não pelo nome) para usar SEMPRE a versão deste pacote (Babel 8):
// pelo nome, o Babel resolvia a partir de cada app e apanhava o preset 7 de outra dependência.
import { fileURLToPath } from "node:url";
// (caminho absoluto: o parser do Babel 8 corre noutro processo e não aceita funções)
const presetTypescript = fileURLToPath(import.meta.resolve("@babel/preset-typescript"));
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [presetTypescript],
        },
      },
    },
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
