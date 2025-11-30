import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatContainer } from '@/components/chat/ChatContainer'

const meta = {
  title: 'Chat/ChatContainer',
  component: ChatContainer,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatContainer>

export default meta
type Story = StoryObj<typeof meta>

// Mock responses for demo
const mockResponses = [
  "Hi! I'm Scarlett, your English tutor. What would you like to learn today?",
  "That's a great question! Let me help you understand that better.",
  "You're making excellent progress! Keep it up!",
  "Here's a helpful tip: try listening to songs with clear pronunciation first.",
  "Would you like me to explain any specific vocabulary from that song?",
]

let responseIndex = 0

/**
 * Full interactive demo with mock LLM responses
 */
export const Interactive: Story = {
  args: {
    onSendMessage: async (message, context) => {
      console.log('Send message:', message)
      console.log('Context:', context)

      // Simulate LLM delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Return a mock response
      const response = mockResponses[responseIndex % mockResponses.length]
      responseIndex++
      return response
    },
  },
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    onSendMessage: async (message) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      return `You said: "${message}". That's interesting! Tell me more.`
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Without LLM handler (messages persist but no responses)
 */
export const NoLLM: Story = {
  args: {},
}
