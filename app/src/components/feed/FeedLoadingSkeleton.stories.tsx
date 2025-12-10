import type { Meta, StoryObj } from 'storybook-solidjs'
import { FeedLoadingSkeleton } from './FeedLoadingSkeleton'

const meta: Meta<typeof FeedLoadingSkeleton> = {
  title: 'Feed/FeedLoadingSkeleton',
  component: FeedLoadingSkeleton,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof FeedLoadingSkeleton>

/**
 * Default loading skeleton
 */
export const Default: Story = {
  render: () => <FeedLoadingSkeleton />,
}
