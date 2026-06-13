// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Stylistic rules (moved out of ESLint core in v10)
      '@stylistic/quotes': ['warn', 'single'],
      '@stylistic/indent': ['warn', 2, { SwitchCase: 1 }],
      '@stylistic/semi': ['warn', 'always'],
      '@stylistic/comma-dangle': ['warn', 'always-multiline'],
      '@stylistic/comma-spacing': ['error'],
      '@stylistic/brace-style': ['warn'],
      '@stylistic/no-multi-spaces': ['warn', { ignoreEOLComments: true }],
      '@stylistic/no-trailing-spaces': ['warn'],
      '@stylistic/lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
      '@stylistic/max-len': ['warn', { code: 140 }],
      '@stylistic/member-delimiter-style': ['warn'],

      // Logical rules
      'dot-notation': 'off',
      'eqeqeq': 'warn',
      'curly': ['warn', 'all'],
      'prefer-arrow-callback': ['warn'],
      'no-console': ['warn'], // use the provided Homebridge log method instead

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
);
