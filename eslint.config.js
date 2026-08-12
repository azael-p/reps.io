import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const vitestGlobals = {
  vi: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // useToast convive con ToastProvider en Toast.jsx; HMR lo tolera.
      'react-refresh/only-export-components': ['error', { allowConstantExport: true, allowExportNames: ['useToast'] }],
      // La regla también marca el patrón fetch-on-mount (setState async dentro
      // de cargar()); solo los setState síncronos reales son un problema.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Scripts one-off con firebase-admin: corren en Node.
    files: ['scripts/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Tests y setup de Vitest (globals: true en vite.config.js).
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...vitestGlobals } },
  },
])
