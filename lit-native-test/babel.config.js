module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Enable import.meta polyfill for Hermes
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      // Inline environment variables for better polyfill support
      'transform-inline-environment-variables',
    ],
  };
};
