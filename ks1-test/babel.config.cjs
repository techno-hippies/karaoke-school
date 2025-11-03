module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Inline environment variables at build time
      // This is needed for Metro's require.context() to work with ONE_ROUTER_APP_ROOT_RELATIVE_TO_ENTRY
      'transform-inline-environment-variables',
    ],
  };
};
