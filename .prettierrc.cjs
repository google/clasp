module.exports = {
  endOfLine: 'lf',
  printWidth: 120,
  quoteProps: 'as-needed',
  semi: true,
  tabWidth: 2,
  useTabs: false,

  // Apply `gts` defaults
  ...require('gts/.prettierrc.json'),
};
