import type { Preview } from 'storybook-solidjs'
import { MemoryRouter, Route } from '@solidjs/router'
import { CurrencyProvider } from '../src/contexts/CurrencyContext'
import { VideoPlaybackProvider } from '../src/contexts/VideoPlaybackContext'
import { QueryProvider } from '../src/providers/QueryProvider'
import { I18nProvider } from '../src/lib/i18n'
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
      <QueryProvider>
        <MemoryRouter root={(props) => (
          <I18nProvider>
            <CurrencyProvider>
              <VideoPlaybackProvider>
                {props.children}
              </VideoPlaybackProvider>
            </CurrencyProvider>
          </I18nProvider>
        )}>
          <Route path="*" component={Story} />
        </MemoryRouter>
      </QueryProvider>
    ),
  ],
}

export default preview
