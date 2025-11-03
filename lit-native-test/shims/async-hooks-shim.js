// Shim for node:async_hooks in React Native
// This module is used by One.js server code but shouldn't run on native

export class AsyncLocalStorage {
  constructor() {
    this.store = new Map();
  }

  run(store, callback, ...args) {
    const previousStore = this.getStore();
    this.enterWith(store);
    try {
      return callback(...args);
    } finally {
      if (previousStore) {
        this.enterWith(previousStore);
      }
    }
  }

  getStore() {
    return this.store.get('current');
  }

  enterWith(store) {
    this.store.set('current', store);
  }

  exit(callback, ...args) {
    const previousStore = this.getStore();
    this.enterWith(undefined);
    try {
      return callback(...args);
    } finally {
      if (previousStore) {
        this.enterWith(previousStore);
      }
    }
  }

  disable() {
    this.store.delete('current');
  }
}

export default {
  AsyncLocalStorage,
};
