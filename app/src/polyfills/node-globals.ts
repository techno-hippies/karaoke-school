// src/polyfills/node-globals.ts
// Safety net for non-HTML entries (Storybook, tests, etc.)
// Main index.html has inline script that runs first
if (typeof window !== 'undefined') {
  const w = window as any

  w.global = w.globalThis || w.global || w

  if (!w.process) {
    w.process = { env: { NODE_ENV: 'production' } }
  }

  if (!w.Buffer) {
    w.Buffer = []
  }
}
