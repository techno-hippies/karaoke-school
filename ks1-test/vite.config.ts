import type { UserConfig } from 'vite'
import { one } from 'one/vite'
import { tamaguiPlugin } from '@tamagui/vite-plugin'
import { fileURLToPath } from 'url'

export default {
  plugins: [
    one({
      react: {
        compiler: process.env.NODE_ENV === 'production',
      },

      web: {
        defaultRenderMode: 'spa',  // Changed from 'ssg' to 'spa' to avoid SSR issues with Lit Protocol
      },

      native: {
        // set to the key of your native app
        // will call AppRegistry.registerComponent(app.key)
        key: 'one-example',
        bundler: 'metro',
        bundlerOptions: {
          babelConfigOverrides(defaultConfig) {
            return {
              ...defaultConfig,
              plugins: [
                ...(defaultConfig.plugins || []),
                // React Compiler
                ['babel-plugin-react-compiler', {}],
              ],
            }
          },
        },
      },
    }),

    tamaguiPlugin({
      optimize: process.env.NODE_ENV === 'production',
      components: ['tamagui'],
      config: './src/tamagui/tamagui.config.ts',
      outputCSS: './src/tamagui/tamagui.css',
    }),
  ],

  // Copy main app's simple config (works with Lit Protocol)
  define: {
    'global': 'globalThis',
  },

  resolve: {
    alias: {
      buffer: 'buffer',
      // Stub for SDK 53 compatibility
      'expo-modules-core/src/web/index.web.ts': fileURLToPath(new URL('./src/stubs/expo-modules-core/src/web/index.web.ts', import.meta.url)),
    },
    conditions: ['import', 'module', 'browser', 'default'],
  },

  optimizeDeps: {
    include: ['buffer'],
  },
} satisfies UserConfig
