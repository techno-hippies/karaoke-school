import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import * as previewAnnotations from './preview'

// This is THE KEY LINE - it loads your preview config (decorators, etc) into tests
setProjectAnnotations([a11yAddonAnnotations, previewAnnotations])

// Initialize i18n for tests
beforeAll(async () => {
  const { default: i18n } = await import('../src/i18n/config')
  await i18n.changeLanguage('en')
})
