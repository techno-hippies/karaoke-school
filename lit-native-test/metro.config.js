const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add Node.js module shims/polyfills
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Core polyfills
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer/'),
  path: require.resolve('path-browserify'),
  process: require.resolve('process/browser'),
  events: require.resolve('events'),
  util: path.resolve(__dirname, 'shims/util-shim.js'),
  url: require.resolve('url'),

  // Custom shims
  fs: path.resolve(__dirname, 'shims/fs-shim.js'),
  async_hooks: path.resolve(__dirname, 'shims/async-hooks-shim.js'),
  'node:async_hooks': path.resolve(__dirname, 'shims/async-hooks-shim.js'),

  // Empty stubs for other modules Lit Protocol might need
  os: require.resolve('os-browserify/browser'),
  https: require.resolve('https-browserify'),
  http: require.resolve('stream-http'),
  zlib: require.resolve('browserify-zlib'),
  assert: require.resolve('assert'),
  constants: require.resolve('constants-browserify'),
  vm: require.resolve('vm-browserify'),
};

// Enable experimental features - preserve existing transformer
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
