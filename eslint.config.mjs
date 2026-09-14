export default [
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'reports/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly', navigator: 'readonly',
        performance: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly', ResizeObserver: 'readonly', CustomEvent: 'readonly',
        fetch: 'readonly', URL: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly', module: 'readonly', globalThis: 'readonly'
      }
    },
    rules: {
      'no-unreachable': 'error',
      'no-dupe-keys': 'warn',
      'no-dupe-args': 'error',
      'no-constant-binary-expression': 'warn',
      'no-self-assign': 'warn',
      'no-func-assign': 'warn',
      'no-import-assign': 'error',
      'no-debugger': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' }
  }
];
