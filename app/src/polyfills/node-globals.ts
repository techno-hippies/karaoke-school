// src/polyfills/node-globals.ts
import process from 'process'
import { Buffer } from 'buffer'

// Make Node-style globals available in the browser.
// Guard so we don't overwrite anything if it already exists.
if (typeof window !== 'undefined') {
  const w = window as any

  if (!w.process) {
    w.process = process
  }

  if (!w.Buffer) {
    w.Buffer = Buffer
  }
}
