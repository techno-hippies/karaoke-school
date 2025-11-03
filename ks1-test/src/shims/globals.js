// Global polyfills for React Native
import { Buffer } from 'buffer';
import process from 'process';

// Set up globals
global.Buffer = Buffer;
global.process = process;

// Polyfill crypto.getRandomValues for React Native
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = (arr) => {
    // Use React Native's crypto if available, otherwise use Math.random
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  };
}
