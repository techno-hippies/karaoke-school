import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'oklch(0.1818 0.0170 299.9718)' },
        { name: 'light', value: 'oklch(1.0000 0 0)' },
      ],
    },
  },
};

export default preview;