import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Lit Protocol chunks
          if (id.includes('@lit-protocol')) {
            return 'lit-core';
          }
          
          // Lens Protocol chunks
          if (id.includes('@lens-protocol')) {
            return 'lens-core';
          }
          
          // Web3/EVM chunks
          if (id.includes('viem') || id.includes('wagmi')) {
            return 'web3-core';
          }
          
          // React Router and state management
          if (id.includes('react-router') || id.includes('@tanstack')) {
            return 'routing';
          }
          
          // UI components
          if (id.includes('@radix-ui') || id.includes('@phosphor-icons')) {
            return 'ui-libs';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB since we've chunked things
  },
})
