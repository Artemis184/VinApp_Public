// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

export default tseslint.config(
  {
    ignores: ["**/.angular/**", "**/node_modules/**", "**/www/**", "**/dist/**", "**/*.d.ts", "**/index.html"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    processor: angular.processInlineTemplates,
    rules: {
      // "@angular-eslint/component-class-suffix": [
      //   "error",
      //   {
      //     "suffixes": ["Page", "Component"]
      //   }
      // ],
      // "@angular-eslint/component-selector": [
      //   "error",
      //   {
      //     "type": "element",
      //     "prefix": "app",
      //     "style": "kebab-case"
      //   }
      // ],
      // "@angular-eslint/directive-selector": [
      //   "error",
      //   {
      //     "type": "attribute",
      //     "prefix": "app",
      //     "style": "camelCase"
      //   }
      // ],
      "linebreak-style": ["error", "unix"],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    },
  },
  {
    files: ["**/*.html"],
    languageOptions: {
      parser: angular.templateParser,
    },
    // extends: [
    //   ...angular.configs.templateRecommended,
    //   ...angular.configs.templateAccessibility,
    // ],
    rules: {},
  }
);
