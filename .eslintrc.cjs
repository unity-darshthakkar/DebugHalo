module.exports = {
  root: true,
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint-config-prettier',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-debugger': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    {
      files: ['*.test.ts'],
      env: {
        jest: true,
      },
    },
    {
      files: ['src/cli/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
