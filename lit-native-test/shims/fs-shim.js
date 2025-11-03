// Minimal fs shim for React Native
// node-localstorage needs this, but we can provide stubs since
// actual storage will use AsyncStorage or similar

const noop = () => {};
const noopSync = () => undefined;

// Helper to ensure callback exists
const ensureCallback = (callback) => {
  return typeof callback === 'function' ? callback : () => {};
};

module.exports = {
  // Read operations (return empty/default values)
  readFile: (path, encoding, callback) => {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = 'utf8';
    }
    ensureCallback(callback)(null, '');
  },
  readFileSync: () => '',
  readdir: (path, callback) => ensureCallback(callback)(null, []),
  readdirSync: () => [],
  stat: (path, callback) => ensureCallback(callback)(null, {
    isDirectory: () => false,
    isFile: () => true,
    size: 0,
  }),
  statSync: () => ({
    isDirectory: () => false,
    isFile: () => true,
    size: 0,
  }),

  // Write operations (no-ops for now)
  writeFile: (path, data, encoding, callback) => {
    if (typeof encoding === 'function') {
      callback = encoding;
    }
    ensureCallback(callback)(null);
  },
  writeFileSync: noopSync,
  appendFile: (path, data, callback) => ensureCallback(callback)(null),
  appendFileSync: noopSync,

  // Directory operations
  mkdir: (path, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    ensureCallback(callback)(null);
  },
  mkdirSync: noopSync,
  rmdir: (path, callback) => ensureCallback(callback)(null),
  rmdirSync: noopSync,

  // File operations
  unlink: (path, callback) => ensureCallback(callback)(null),
  unlinkSync: noopSync,
  rename: (oldPath, newPath, callback) => ensureCallback(callback)(null),
  renameSync: noopSync,

  // Existence checks
  exists: (path, callback) => ensureCallback(callback)(false),
  existsSync: () => false,

  // Constants
  constants: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_CREAT: 64,
    O_EXCL: 128,
    O_TRUNC: 512,
    O_APPEND: 1024,
  },
};
