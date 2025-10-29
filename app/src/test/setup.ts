import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock WebAuthn API for testing
Object.defineProperty(window, 'fetch', {
  writable: true,
  value: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock CSS.escape polyfill for older browsers
global.CSS = {
  escape: vi.fn((str) => str),
}
