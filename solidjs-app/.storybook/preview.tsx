import type { Preview } from 'storybook-solidjs'
import { CurrencyProvider } from '../src/contexts/CurrencyContext'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#09090b' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <CurrencyProvider>
        <Story />
      </CurrencyProvider>
    ),
  ],
}

export default preview
