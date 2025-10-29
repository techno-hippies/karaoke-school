/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
    conditions: ['import', 'module', 'browser', 'default'],
  },
  optimizeDeps: {
    include: ['@lens-chain/sdk/viem', 'buffer'],
  },
  define: {
    'global': 'globalThis',
  },
})
