import type { Meta, StoryObj } from '@storybook/react'
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
 * Default feed starting on For You tab
 * Shows global karaoke feed
 */
export const ForYouTab: Story = {
  args: {
    defaultTab: 'for-you',
  },
}

/**
 * Feed starting on Following tab
 * Shows personalized feed from followed creators
 * Requires authentication
 */
export const FollowingTab: Story = {
  args: {
    defaultTab: 'following',
  },
}

/**
 * Following tab when not authenticated
 * Shows sign-in prompt
 */
export const FollowingUnauthenticated: Story = {
  args: {
    defaultTab: 'following',
  },
  parameters: {
    docs: {
      description: {
        story: 'When user is not authenticated, Following tab shows a sign-in prompt',
      },
    },
  },
}
