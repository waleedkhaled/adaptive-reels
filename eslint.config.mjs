// Root lint config for the TypeScript packages and pipeline.
// apps/mobile has its own Expo config (apps/mobile/eslint.config.js).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const AGENT_PURITY = 'The agent is pure: take time and randomness as inputs (see docs/PLAN.md).';

export default defineConfig([
  {
    ignores: ['**/node_modules/**', 'apps/mobile/**', 'library/**', '**/dist/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/agent/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: AGENT_PURITY },
        { object: 'Math', property: 'random', message: AGENT_PURITY },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: AGENT_PURITY,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'react', 'react-native', 'react-native/*', 'expo', 'expo-*'],
              message: 'The agent must run in plain JS (Node tests and the app).',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
