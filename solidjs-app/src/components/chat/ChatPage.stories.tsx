import type { Meta, StoryObj } from 'storybook-solidjs'
import { ChatPage, type ChatItem } from './ChatPage'

const meta: Meta<typeof ChatPage> = {
  title: 'Chat/ChatPage',
  component: ChatPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof ChatPage>

const sampleItems: ChatItem[] = [
  {
    type: 'message',
    id: '1',
    props: {
      content: "Hey! I'm Scarlett, your AI language tutor. Ready to learn some English through music?",
      sender: 'ai',
      showTranslate: true,
      hasAudio: true,
    },
  },
  {
    type: 'message',
    id: '2',
    props: {
      content: "Yes! I want to learn the vocabulary from 'Toxic' by Britney Spears.",
      sender: 'user',
    },
  },
  {
    type: 'message',
    id: '3',
    props: {
      content:
        "Great choice! 'Toxic' has some interesting vocabulary. Let's start with the chorus. The word 'intoxicated' means to be strongly affected by something, usually in an overwhelming way.",
      sender: 'ai',
      showTranslate: true,
      hasAudio: true,
    },
  },
]

// Default chat page
export const Default: Story = {
  args: {
    items: sampleItems,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
      onStartRecording: () => console.log('Start recording'),
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}

// With typing indicator
export const WithTyping: Story = {
  args: {
    items: sampleItems,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    isTyping: true,
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// With upgrade button
export const WithUpgrade: Story = {
  args: {
    items: sampleItems,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    showUpgrade: true,
    onUpgrade: () => console.log('Upgrade clicked'),
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// Without header
export const NoHeader: Story = {
  args: {
    items: sampleItems,
    showHeader: false,
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// With survey question
export const WithSurvey: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Hi there! I'm Scarlett, your music-loving AI tutor. Before we begin, I'd love to learn a bit about you!",
          sender: 'ai',
        },
      },
      {
        type: 'survey',
        id: '2',
        props: {
          question: "What kind of music do you enjoy?",
          options: [
            { id: 'pop', label: 'Pop' },
            { id: 'rock', label: 'Rock' },
            { id: 'hiphop', label: 'Hip-Hop' },
            { id: 'electronic', label: 'Electronic' },
          ],
          onSelect: (option) => console.log('Selected:', option),
        },
      },
    ],
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      disabled: true,
      placeholder: 'Select an option above...',
    },
  },
}

// Survey answered and continuing
export const SurveyAnswered: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Hi there! I'm Scarlett. Let me learn a bit about you!",
          sender: 'ai',
        },
      },
      {
        type: 'survey',
        id: '2',
        props: {
          question: "What kind of music do you enjoy?",
          options: [
            { id: 'pop', label: 'Pop' },
            { id: 'rock', label: 'Rock' },
            { id: 'hiphop', label: 'Hip-Hop' },
            { id: 'electronic', label: 'Electronic' },
          ],
          selectedId: 'pop',
          disabled: true,
        },
      },
      {
        type: 'message',
        id: '3',
        props: {
          content: "Pop music! Excellent choice. There are so many great pop songs to learn English from. Do you have a favorite artist?",
          sender: 'ai',
          showTranslate: true,
        },
      },
    ],
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// Empty state
export const Empty: Story = {
  args: {
    items: [],
    title: 'New Chat',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Start a conversation...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// Long conversation
export const LongConversation: Story = {
  args: {
    items: [
      ...sampleItems,
      {
        type: 'message',
        id: '4',
        props: {
          content: "That's really helpful! Can you explain more about metaphors in the song?",
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '5',
        props: {
          content:
            "Absolutely! The song uses the metaphor of poison and addiction throughout. When she sings about being 'addicted' and 'intoxicated', she's comparing intense romantic feelings to the effects of a substance. This is a common metaphor in English - we often describe love as something that can make us 'drunk' or 'high'.",
          sender: 'ai',
          showTranslate: true,
          hasAudio: true,
        },
      },
      {
        type: 'message',
        id: '6',
        props: {
          content: 'Are there other songs that use similar metaphors?',
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '7',
        props: {
          content:
            "Yes! Many pop songs use the love-as-addiction metaphor. For example, 'Bad Habits' by Ed Sheeran, 'Love Is A Drug' by Roxy Music, and 'Addicted To Love' by Robert Palmer. These all play with the idea that romantic feelings can be overwhelming and hard to control.",
          sender: 'ai',
          showTranslate: true,
          hasAudio: true,
        },
      },
    ],
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// Violet personality
export const VioletPersonality: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Hey~ I'm Violet! I love anime, gaming, and helping people learn languages through fun content. What brings you here today?",
          sender: 'ai',
          showTranslate: true,
        },
      },
      {
        type: 'message',
        id: '2',
        props: {
          content: 'I want to learn Japanese through anime!',
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '3',
        props: {
          content:
            "Omg yesss! Anime is such a fun way to learn Japanese. What shows are you watching right now? I can help break down some common phrases and teach you the cultural context!",
          sender: 'ai',
          showTranslate: true,
          hasAudio: true,
        },
      },
    ],
    title: 'Violet',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      placeholder: 'Type a message...',
      onSend: (message) => console.log('Send:', message),
    },
  },
}

// Recording state
export const Recording: Story = {
  args: {
    items: sampleItems,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      isRecording: true,
      recordingDuration: 5,
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}

// Processing transcription
export const Processing: Story = {
  args: {
    items: sampleItems,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back clicked'),
    inputProps: {
      isProcessing: true,
    },
  },
}
