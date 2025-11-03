const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add Node.js module polyfills/shims for React Native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  path: require.resolve('path-browserify'),
  fs: require.resolve('./src/shims/fs-shim'),
  'async_hooks': require.resolve('./src/shims/async-hooks-shim'),
  'node:async_hooks': require.resolve('./src/shims/async-hooks-shim'),
  buffer: require.resolve('buffer/'),
  stream: require.resolve('stream-browserify'),
  process: require.resolve('process/browser'),
  events: require.resolve('events/'),
  util: require.resolve('util/'),
  url: require.resolve('url/'),
  crypto: require.resolve('crypto-browserify'),
};

module.exports = config;
