import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { withI18n, globalTypes } from './i18n'

const preview: Preview = {
  decorators: [withI18n],
  globalTypes,
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    backgrounds: {
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1.0000 0 0)' },
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
    locale: 'en',
  },
};

export default preview;