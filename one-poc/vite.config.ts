import type { UserConfig } from 'vite'
import { one } from 'one/vite'
import { tamaguiPlugin } from '@tamagui/vite-plugin'

export default {
  plugins: [
    tamaguiPlugin({
      optimize: true,
      components: ['tamagui'],
      config: './config/tamagui.config.ts',
    }),
    one({
      web: {
        defaultRenderMode: 'spa', // Use SPA for simplicity in PoC
      },
      native: {
        key: 'OnePocLitProtocol',
        bundler: 'metro', // Use stable Metro for Android
      },
    }),
  ],
  optimizeDeps: {
    exclude: [
      '@lit-protocol/auth',
      '@lit-protocol/auth-helpers',
      '@lit-protocol/lit-client',
      '@lit-protocol/lit-node-client',
      '@lit-protocol/networks',
    ],
  },
  resolve: {
    alias: {
      // Work around viem version conflicts
      '@wagmi/core': false,
    },
  },
} satisfies UserConfig
