module.exports = {
  extends: ['xo-typescript/space', './node_modules/gts/', './node_modules/xo/config/plugins.js'],
  rules: {
    'array-callback-return': 'warn',
    camelcase: 'warn',
    // 'capitalized-comments': 'warn',
    'no-await-in-loop': 'warn',
    'no-case-declarations': 'warn',
    // 'no-warning-comments': [
    //   'warn',
    //   {
    //     terms: ['todo', 'fixme', 'xxx'],
    //     location: 'start',
    //   },
    // ],
    // '@typescript-eslint/consistent-type-assertions': 'warn',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/prefer-readonly-parameter-types': 'warn',
    'quotes': 'off',
    '@typescript-eslint/quotes': 'warn',
    // '@typescript-eslint/restrict-plus-operands': 'warn',
    '@typescript-eslint/restrict-template-expressions': [
      'warn',
      {
        allowBoolean: true,
        allowNullable: true,
        allowNumber: true,
      },
    ],
    // 'ava/no-ignored-test-files': [
    //   'error',
    //   {
    //     extensions: ['ts'],
    //     files: ['**/*.spec.ts'],
    //   },
    // ],
    'eslint-comments/no-unused-disable': 'warn',
    // 'import/no-unassigned-import': 'warn',
    'new-cap': 'warn',
    // 'node/prefer-global/url': 'warn',
    // 'node/prefer-global/url-search-params': 'warn',
    // 'unicorn/filename-case': 'warn',
    'unicorn/no-fn-reference-in-iterator': 'warn',
    'no-process-exit': 'off',
    'unicorn/no-process-exit': 'warn',
    'unicorn/no-reduce': 'warn',
    'unicorn/prefer-optional-catch-binding': 'warn',
    // 'unicorn/string-content': [
    //   'warn',
    //   {
    //     patterns: {
    //       httphttp: {
    //         suggest: 'HTTP',
    //         message: 'Do you mean HTTP?',
    //         fix: false,
    //       },
    //       '\\.\\.\\.': {
    //         suggest: '…',
    //         fix: false,
    //       },
    //     },
    //   },
    // ],
  },
};
