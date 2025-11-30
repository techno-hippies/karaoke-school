import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeedPage } from '@/components/feed/FeedPage'
import { AuthProvider } from '@/contexts/AuthContext'
import { LensProvider } from '@lens-protocol/react'
import { lensClient } from '@/lib/lens/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const meta = {
  title: 'Feed/FeedPage',
  component: FeedPage,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })

      return (
        <LensProvider client={lensClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Story />
            </AuthProvider>
          </QueryClientProvider>
        </LensProvider>
      )
    },
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeedPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default feed showing global karaoke videos
 */
export const Default: Story = {}
