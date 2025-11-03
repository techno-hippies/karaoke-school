// Enhanced util shim for React Native with proper promisify support
const utilBase = require('util');

// Custom promisify implementation that's more forgiving
function promisify(original) {
  if (typeof original !== 'function') {
    // Instead of throwing, return a function that rejects
    return function promisified(...args) {
      return Promise.reject(
        new TypeError('The "original" argument must be of type function')
      );
    };
  }

  function promisified(...args) {
    return new Promise((resolve, reject) => {
      try {
        original(...args, (err, ...values) => {
          if (err) {
            return reject(err);
          }
          if (values.length === 0) {
            return resolve();
          }
          if (values.length === 1) {
            return resolve(values[0]);
          }
          resolve(values);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  return promisified;
}

// Export enhanced util with our custom promisify
module.exports = {
  ...utilBase,
  promisify,
  // Add other commonly used util methods
  callbackify: utilBase.callbackify || ((fn) => fn),
  deprecate: utilBase.deprecate || ((fn, msg) => fn),
  debuglog: utilBase.debuglog || (() => () => {}),
  format: utilBase.format || ((...args) => args.join(' ')),
  inherits: utilBase.inherits || ((ctor, superCtor) => {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }),
  inspect: utilBase.inspect || ((obj) => JSON.stringify(obj, null, 2)),
  isArray: Array.isArray,
  isBoolean: (arg) => typeof arg === 'boolean',
  isNull: (arg) => arg === null,
  isNullOrUndefined: (arg) => arg == null,
  isNumber: (arg) => typeof arg === 'number',
  isString: (arg) => typeof arg === 'string',
  isSymbol: (arg) => typeof arg === 'symbol',
  isUndefined: (arg) => arg === undefined,
  isRegExp: (arg) => arg instanceof RegExp,
  isObject: (arg) => typeof arg === 'object' && arg !== null,
  isDate: (arg) => arg instanceof Date,
  isError: (arg) => arg instanceof Error,
  isFunction: (arg) => typeof arg === 'function',
  isPrimitive: (arg) => {
    const type = typeof arg;
    return arg === null || (type !== 'object' && type !== 'function');
  },
  isBuffer: (arg) => {
    return arg && typeof arg === 'object' && typeof arg.constructor === 'function' &&
      typeof arg.constructor.isBuffer === 'function' && arg.constructor.isBuffer(arg);
  },
  types: {
    isAsyncFunction: (arg) => typeof arg === 'function' && arg.constructor.name === 'AsyncFunction',
    isGeneratorFunction: (arg) => typeof arg === 'function' && arg.constructor.name === 'GeneratorFunction',
    isPromise: (arg) => arg instanceof Promise,
    isProxy: () => false,
    isTypedArray: (arg) => ArrayBuffer.isView(arg) && !(arg instanceof DataView),
  },
};
