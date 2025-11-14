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
    'process.env': '{}',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Lit Protocol chunks - large and independent
          if (id.includes('@lit-protocol')) {
            return 'lit-core';
          }

          // Lens Protocol chunks - large and independent
          if (id.includes('@lens-protocol')) {
            return 'lens-core';
          }

          // UI components - independent
          if (id.includes('@radix-ui') || id.includes('@phosphor-icons')) {
            return 'ui-libs';
          }

          // Let Vite handle viem/wagmi/React Router automatically to avoid circular deps
        },
      },
    },
    chunkSizeWarningLimit: 2000, // Increase limit since we're chunking less
  },
})
