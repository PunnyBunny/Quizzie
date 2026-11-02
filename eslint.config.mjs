import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

const contractsImports = {
  group: ["@vaca/contracts", "@vaca/contracts/*"],
  allowTypeImports: true,
  message: "Use import type or export type for @vaca/contracts.",
};

export default defineConfig(
  {
    // Build output only — "**/lib/**" would also swallow apps/web/src/lib/.
    ignores: ["apps/functions/lib/**", "apps/web/dist/**"],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-restricted-imports": ["error", { patterns: [contractsImports] }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            contractsImports,
            {
              group: ["**/functions/src", "**/functions/src/**"],
              message: "Import shared DTOs and API types from @vaca/contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
