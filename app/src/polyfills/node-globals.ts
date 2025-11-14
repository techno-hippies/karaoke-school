// src/polyfills/node-globals.ts
// Safety net for non-HTML entries (Storybook, tests, etc.)
// Main index.html has inline script that runs first
import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  const w = window as any

  w.global = w.globalThis || w.global || w

  if (!w.process) {
    w.process = { env: { NODE_ENV: 'production' } }
  }

  // Assign the real Buffer class from the buffer package
  // This is required by Lit Protocol SDK for Buffer.from() and other methods
  if (!w.Buffer) {
    w.Buffer = Buffer
  }
}
