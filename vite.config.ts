import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Use relative paths for IPFS compatibility
  base: './',
  
  plugins: [
    react(), 
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    })
  ],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "fs/promises": "node-stdlib-browser/mock/empty",
      "fs": "node-stdlib-browser/mock/empty",
    },
  },
  
  optimizeDeps: {
    include: ['buffer', 'process', '@lit-protocol/auth', '@lit-protocol/lit-client', '@lit-protocol/networks'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  
  build: {
    // Output configuration for IPFS
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Optimize for production
    minify: 'esbuild',
    target: 'esnext',
  },
  
  server: {
    host: true,
    allowedHosts: ['35addf2ed535.ngrok-free.app'],
    hmr: {
      host: 'localhost'
    },
    proxy: {
      // Proxy GraphQL requests to local Graph Node
      '/subgraphs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  
  // Handle MIME types for IPFS
  assetsInclude: ['**/*.wasm', '**/*.json'],
})
