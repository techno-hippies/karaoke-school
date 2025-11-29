import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || (mode === 'production' ? './' : '/')

  return {
    // Use a relative base so assets resolve correctly when served from IPFS/Fleek gateways
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        buffer: 'buffer',
        process: 'process/browser',
      },
      conditions: ['import', 'module', 'browser', 'default'],
    },
    optimizeDeps: {
      include: ['@lens-chain/sdk/viem', 'buffer', 'process'],
    },
    define: {
      global: 'globalThis',
      // Provide empty process.env for Node polyfills
      // VITE_* vars are automatically available via import.meta.env
      'process.env': {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Lit Protocol chunks - large and independent
            if (id.includes('@lit-protocol')) {
              return 'lit-core'
            }

            // Lens Protocol chunks - large and independent
            if (id.includes('@lens-protocol')) {
              return 'lens-core'
            }

            // UI components - independent
            if (id.includes('@radix-ui') || id.includes('@phosphor-icons')) {
              return 'ui-libs'
            }

            // Let Vite handle viem/wagmi/React Router automatically to avoid circular deps
          },
        },
      },
      chunkSizeWarningLimit: 2000, // Increase limit since we're chunking less
    },
  }
})
