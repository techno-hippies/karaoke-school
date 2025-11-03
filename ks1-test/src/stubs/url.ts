// Custom url polyfill with pathToFileURL for browser
// The standard 'url' package doesn't include pathToFileURL (Node.js only)

export function pathToFileURL(path: string): URL {
  // Convert a file path to a file:// URL
  // This is a simplified browser-safe version
  const normalized = path.replace(/\\/g, '/')
  return new URL(`file://${normalized}`)
}

// Re-export everything from the standard url package
export * from 'url'
