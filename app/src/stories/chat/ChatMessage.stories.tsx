import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatMessage } from '@/components/chat/ChatMessage'

const meta = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md mx-auto p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatMessage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * AI message - left aligned with avatar
 */
export const AIMessage: Story = {
  args: {
    content: "Hello! I'm your English learning assistant. What would you like to practice today?",
    sender: 'ai',
    showTranslate: true,
    onTranslate: () => console.log('Translate clicked'),
  },
}

/**
 * User message - right aligned
 */
export const UserMessage: Story = {
  args: {
    content: "I want to learn some new vocabulary from songs!",
    sender: 'user',
  },
}

/**
 * AI message - short
 */
export const ShortMessage: Story = {
  args: {
    content: "Great choice! Let's start with some popular songs.",
    sender: 'ai',
    showTranslate: true,
  },
}

/**
 * AI message with translation shown
 */
export const WithTranslation: Story = {
  args: {
    content: "The word 'serendipity' means finding something good by accident.",
    sender: 'ai',
    showTranslate: true,
    translation: "「セレンディピティ」とは、偶然良いものを見つけることを意味します。",
  },
}

/**
 * Word highlighting - simulating TTS playback
 */
export const WordHighlighting: Story = {
  args: {
    content: [
      { text: 'The', isHighlighted: false },
      { text: 'quick', isHighlighted: false },
      { text: 'brown', isHighlighted: true },
      { text: 'fox', isHighlighted: false },
      { text: 'jumps', isHighlighted: false },
      { text: 'over', isHighlighted: false },
      { text: 'the', isHighlighted: false },
      { text: 'lazy', isHighlighted: false },
      { text: 'dog.', isHighlighted: false },
    ],
    sender: 'ai',
    showTranslate: true,
  },
}

/**
 * Long message - tests wrapping
 */
export const LongMessage: Story = {
  args: {
    content: "Learning a new language is a journey that takes time and patience. Don't worry if you make mistakes - that's how we learn! Every expert was once a beginner. Keep practicing, stay curious, and most importantly, have fun with it!",
    sender: 'ai',
    showTranslate: true,
  },
}

/**
 * AI message with custom avatar
 */
export const WithAvatar: Story = {
  args: {
    content: "Let me help you improve your English!",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai-tutor',
    showTranslate: true,
  },
}

/**
 * Message while translating
 */
export const Translating: Story = {
  args: {
    content: "This sentence is being translated right now.",
    sender: 'ai',
    showTranslate: true,
    isTranslating: true,
  },
}

/**
 * Conversation example
 */
export const Conversation: Story = {
  render: () => (
    <div className="space-y-4">
      <ChatMessage
        content="Hi! Ready to practice some English?"
        sender="ai"
        showTranslate
      />
      <ChatMessage
        content="Yes! Can we practice with song lyrics?"
        sender="user"
      />
      <ChatMessage
        content="Of course! Song lyrics are a great way to learn. Which artist do you like?"
        sender="ai"
        showTranslate
      />
      <ChatMessage
        content="I love Taylor Swift!"
        sender="user"
      />
    </div>
  ),
}
