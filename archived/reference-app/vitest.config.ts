import { defineConfig } from 'vitest/config.js'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: '.storybook',
      // By default, no stories are tested unless they have 'test' tag
      tags: {
        include: ['vitest'], // Use unique tag name
        exclude: [],
        skip: [],
      },
    }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [
        { browser: 'chromium' }
      ],
    },
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@storybook/react-vite',
      'i18next',
      'react-i18next',
      'react/jsx-dev-runtime',
      'storybook/test',
    ],
  },
})
