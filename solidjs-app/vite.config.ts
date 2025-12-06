import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || (mode === 'production' ? './' : '/')

  return {
    // Use relative base so assets resolve correctly on IPFS/Fleek gateways
    base,
    plugins: [solid(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        buffer: 'buffer',
        process: 'process/browser',
      },
      conditions: ['import', 'module', 'browser', 'default'],
    },
    define: {
      global: 'globalThis',
      'process.env': {},
    },
    optimizeDeps: {
      include: ['buffer', 'process'],
    },
    server: {
      allowedHosts: ['72b0e8677447.ngrok-free.app'],
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Lit Protocol - large and independent
            if (id.includes('@lit-protocol')) {
              return 'lit-core'
            }
            // Lens Protocol - large and independent
            if (id.includes('@lens-protocol')) {
              return 'lens-core'
            }
            // UI components
            if (id.includes('@kobalte')) {
              return 'ui-libs'
            }
          },
        },
      },
    },
  }
})
