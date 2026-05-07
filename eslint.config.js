import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 12.5: tests-e2e/ holds Playwright specs that import `@playwright/test`.
  // Until the package is `npm install`-ed, ignoring the folder keeps lint
  // clean. `playwright.config.ts` does the same. Same for `coverage/`
  // (vitest's lcov dump) and the bundler outputs.
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'tests-e2e',
      'playwright.config.ts',
    ],
  },
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
      // Issue 010 — hard rule: no `#` hex literals or `rgba(...)`
      // outside `theme.ts`. The override below carves out the theme
      // file. Catches new hex-alpha concatenations
      // (`${t.palette.role.x.main}1f`) and raw `rgba(0,0,0,0.4)` at
      // the call site.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/#[0-9a-fA-F]{3,8}\\b/], TemplateElement[value.cooked=/#[0-9a-fA-F]{3,8}\\b/], Literal[value=/rgba?\\s*\\(/], TemplateElement[value.cooked=/rgba?\\s*\\(/]",
          message:
            'Color literals must live in src/theme.ts. Reference them via t.palette.* tokens at call sites.',
        },
      ],
      // Issue 016 — every JSON file under `src/data/` must be reached
      // through the `src/data/index.ts` barrel (the typed loader
      // validates the shape and freezes the array). The carve-out
      // below allows files INSIDE `src/data/` to do the raw imports.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*.json', '**/*.json'],
              message:
                'Import from src/data/index.ts (the typed loader) — never from a .json file directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // The data barrel itself must read the raw JSON in to feed the
    // validators. Disable the loader-only rule for `src/data/**`.
    files: ['src/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // theme.ts is the only place hex / rgba literals are allowed (it's
    // the source of truth for all visual tokens).
    files: ['src/theme.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Card-preview / debug pages set `window.location.hash = '#cards'`
    // (URL fragments, not colors); the regex catches the literal so we
    // disable the rule narrowly.
    files: [
      'src/ui/layout/DevSidebar.tsx',
      'src/ui/cardPreview/**',
      'src/ui/boardPreview/**',
      'src/ui/matPreview/**',
    ],
    rules: {
      'no-restricted-syntax': 'off',
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
