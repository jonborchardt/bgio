import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // All randomness must flow through bgio's random plugin (see
      // src/game/random.ts) so two clients started with the same `seed`
      // produce identical state. A stray `Math.random()` in src/ defeats
      // determinism silently, so we forbid it at the linter.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the bgio random plugin (src/game/random.ts).',
        },
      ],
    },
  },
  {
    // Tests are allowed to use Math.random for fixture-style data that
    // doesn't feed into the deterministic game state. None do today, but
    // pinning the carve-out here keeps the rule's intent (ban in src/)
    // explicit.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
);
