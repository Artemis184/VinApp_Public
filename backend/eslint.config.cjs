const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');
const tseslint = require('typescript-eslint');

module.exports = [
  // ✅ Ignorar carpetas y el propio archivo de config
  {
    ignores: ['node_modules/**', 'dist/**', 'prisma/migrations/**', 'eslint.config.cjs'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],

    plugins: {
      prettier,
    },

    rules: {
      'no-console': 'off',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',

      // ✅ IMPORTANTE: permitir require SOLO en archivos .cjs
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
