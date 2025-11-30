import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatListPage, type ChatConversation } from '@/components/chat'
import { AI_PERSONALITIES } from '@/lib/chat/types'

const meta = {
  title: 'Chat/ChatListPage',
  component: ChatListPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatListPage>

export default meta
type Story = StoryObj<typeof meta>

// Use actual AI personalities
const conversations: ChatConversation[] = AI_PERSONALITIES.map((p) => ({
  id: p.id,
  name: p.name,
  avatarUrl: p.avatarUrl,
  lastMessage: p.description,
}))

/**
 * Default - shows Scarlett and Violet
 */
export const Default: Story = {
  args: {
    conversations,
    onSelectConversation: (conv) => console.log('Selected:', conv.name),
  },
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    conversations,
    onSelectConversation: (conv) => console.log('Selected:', conv.name),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
