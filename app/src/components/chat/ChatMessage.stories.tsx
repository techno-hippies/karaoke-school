import type { Meta, StoryObj } from 'storybook-solidjs'
import { ChatMessage } from './ChatMessage'

const meta: Meta<typeof ChatMessage> = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="max-w-2xl mx-auto p-4 space-y-4 bg-background">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    sender: {
      control: 'radio',
      options: ['ai', 'user'],
    },
    content: {
      control: 'text',
    },
  },
}

export default meta
type Story = StoryObj<typeof ChatMessage>

// Basic AI message
export const AIMessage: Story = {
  args: {
    content: "Hey! I'm Scarlett, your AI language tutor. What would you like to learn today?",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
  },
}

// Basic user message
export const UserMessage: Story = {
  args: {
    content: "I'd like to practice some English vocabulary from song lyrics.",
    sender: 'user',
  },
}

// AI message with translate button
export const WithTranslateButton: Story = {
  args: {
    content: "That's a great choice! Music is one of the best ways to learn a new language. The repetition and melody help words stick in your memory.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showTranslate: true,
    onTranslate: () => console.log('Translate clicked'),
  },
}

// AI message with translation shown
export const WithTranslation: Story = {
  args: {
    content: "That's a great choice! Music is one of the best ways to learn a new language.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showTranslate: true,
    translation: '这是一个很好的选择！音乐是学习新语言最好的方式之一。',
  },
}

// AI message currently translating
export const Translating: Story = {
  args: {
    content: "Let me help you understand this phrase better.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showTranslate: true,
    isTranslating: true,
  },
}

// AI message with audio controls
export const WithAudioControls: Story = {
  args: {
    content: "Hello! How are you doing today? I hope you're ready for our lesson.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    hasAudio: true,
    onPlayAudio: () => console.log('Play clicked'),
    onStopAudio: () => console.log('Stop clicked'),
  },
}

// AI message with audio playing
export const AudioPlaying: Story = {
  args: {
    content: "Hello! How are you doing today? I hope you're ready for our lesson.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    hasAudio: true,
    isPlayingAudio: true,
    onStopAudio: () => console.log('Stop clicked'),
  },
}

// AI message with audio loading
export const AudioLoading: Story = {
  args: {
    content: "Let me speak this for you.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    hasAudio: true,
    isLoadingAudio: true,
  },
}

// Word-level highlighting (TTS sync)
export const WithWordHighlighting: Story = {
  args: {
    content: [
      { text: 'Hello!', isHighlighted: false },
      { text: 'How', isHighlighted: false },
      { text: 'are', isHighlighted: true },
      { text: 'you', isHighlighted: false },
      { text: 'doing', isHighlighted: false },
      { text: 'today?', isHighlighted: false },
    ],
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    hasAudio: true,
    isPlayingAudio: true,
  },
}

// Context indicator - low usage
export const WithContextLow: Story = {
  args: {
    content: "I'm here to help you learn English through music!",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    tokensUsed: 5000,
    maxTokens: 64000,
  },
}

// Context indicator - medium usage
export const WithContextMedium: Story = {
  args: {
    content: "We've been chatting for a while now. Your English is improving!",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    tokensUsed: 50000,
    maxTokens: 64000,
  },
}

// Context indicator - high usage (warning)
export const WithContextHigh: Story = {
  args: {
    content: "We're running low on context space. Consider starting a new conversation soon.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    tokensUsed: 60000,
    maxTokens: 64000,
  },
}

// Full featured AI message
export const FullFeatured: Story = {
  args: {
    content: "Music is a universal language that connects people across cultures. When you learn lyrics, you're not just memorizing words—you're absorbing rhythm, emotion, and cultural context.",
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showTranslate: true,
    hasAudio: true,
    tokensUsed: 12000,
    maxTokens: 64000,
    onTranslate: () => console.log('Translate clicked'),
    onPlayAudio: () => console.log('Play clicked'),
  },
}

// Conversation example
export const Conversation: Story = {
  render: () => (
    <div class="space-y-4">
      <ChatMessage
        content="Hey! I'm Scarlett, your AI language tutor. Ready to learn some English through music?"
        sender="ai"
        avatarUrl="https://api.dicebear.com/7.x/bottts/svg?seed=scarlett"
        showTranslate
        hasAudio
        tokensUsed={500}
        maxTokens={64000}
      />
      <ChatMessage
        content="Yes! I want to learn the lyrics to 'Toxic' by Britney Spears."
        sender="user"
      />
      <ChatMessage
        content="Great choice! 'Toxic' has some interesting vocabulary. Let's start with the chorus: 'With a taste of your lips, I'm on a ride.' The word 'ride' here is a metaphor for an exciting journey or experience."
        sender="ai"
        avatarUrl="https://api.dicebear.com/7.x/bottts/svg?seed=scarlett"
        showTranslate
        hasAudio
        tokensUsed={1500}
        maxTokens={64000}
      />
    </div>
  ),
}

// Long message
export const LongMessage: Story = {
  args: {
    content: `Learning English through music is incredibly effective because music engages multiple parts of your brain simultaneously. When you listen to a song, you're processing:

1. Melody and rhythm - which help with pronunciation and intonation
2. Vocabulary in context - making words easier to remember
3. Grammar patterns - through repeated exposure to natural structures
4. Cultural references - deepening your understanding of the language

The emotional connection to music also releases dopamine, which enhances memory formation. This is why you can remember song lyrics from years ago but struggle to recall vocabulary you studied last week!

Would you like me to recommend some songs that are great for English learners?`,
    sender: 'ai',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showTranslate: true,
    hasAudio: true,
  },
}
