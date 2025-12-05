import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect } from 'react'
import { ChatPage, type ChatItem } from '@/components/chat/ChatPage'
import type { SurveyOption } from '@/components/chat/ChatSurveyMessage'

const meta = {
  title: 'Chat/ChatPage',
  component: ChatPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatPage>

export default meta
type Story = StoryObj<typeof meta>

const sampleConversation: ChatItem[] = [
  {
    type: 'message',
    id: '1',
    props: {
      content: "Hello! I'm your English learning assistant. How can I help you today?",
      sender: 'ai',
      showTranslate: true,
      tokensUsed: 2800,
      maxTokens: 32000,
    },
  },
  {
    type: 'message',
    id: '2',
    props: {
      content: "I want to learn vocabulary from song lyrics!",
      sender: 'user',
    },
  },
  {
    type: 'message',
    id: '3',
    props: {
      content: "Great choice! Song lyrics are an excellent way to learn natural English expressions. Which artist or song would you like to start with?",
      sender: 'ai',
      showTranslate: true,
      tokensUsed: 5200,
      maxTokens: 32000,
    },
  },
]

/**
 * Default chat page with conversation
 */
export const Default: Story = {
  args: {
    items: sampleConversation,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back'),
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * Empty chat - first message
 */
export const Empty: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Hi there! I'm here to help you learn English through music. What would you like to explore today?",
          sender: 'ai',
          showTranslate: true,
          tokensUsed: 1200,
          maxTokens: 32000,
        },
      },
    ],
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back'),
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * AI is typing
 */
export const Typing: Story = {
  args: {
    items: sampleConversation,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back'),
    isTyping: true,
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * With word highlighting (TTS playback)
 */
export const WordHighlighting: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: [
            { text: 'The', isHighlighted: false },
            { text: 'lyrics', isHighlighted: false },
            { text: 'of', isHighlighted: false },
            { text: 'this', isHighlighted: true },
            { text: 'song', isHighlighted: false },
            { text: 'mean', isHighlighted: false },
            { text: 'that', isHighlighted: false },
            { text: 'love', isHighlighted: false },
            { text: 'conquers', isHighlighted: false },
            { text: 'all.', isHighlighted: false },
          ],
          sender: 'ai',
          showTranslate: true,
          tokensUsed: 12500,
          maxTokens: 32000,
        },
      },
    ],
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * Onboarding flow with surveys
 */
export const OnboardingFlow: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Welcome to K-School! I'm your English learning companion. Let's personalize your experience.",
          sender: 'ai',
          showTranslate: true,
        },
      },
      {
        type: 'survey',
        id: '2',
        props: {
          question: "Of these musicians, who is your favorite?",
          options: [
            { id: 'beyonce', label: 'Beyoncé' },
            { id: 'blackpink', label: 'BLACKPINK' },
            { id: 'jay-chou', label: 'Jay Chou' },
            { id: 'beatles', label: 'The Beatles' },
            { id: 'none', label: 'None of these' },
          ],
          onSelect: (opt) => console.log('Selected musician:', opt),
        },
      },
    ],
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      disabled: true,
      placeholder: 'Select an option above...',
    },
  },
}

/**
 * With translation shown
 */
export const WithTranslation: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "The word 'serendipity' means finding something good by accident. It's a beautiful word!",
          sender: 'ai',
          showTranslate: true,
          translation: "「セレンディピティ」という言葉は、偶然良いものを見つけることを意味します。美しい言葉ですね！",
          tokensUsed: 8200,
          maxTokens: 32000,
        },
      },
      {
        type: 'message',
        id: '2',
        props: {
          content: "That's a cool word! Are there more like it?",
          sender: 'user',
        },
      },
    ],
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    items: sampleConversation,
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
      onVoiceInput: () => console.log('Voice'),
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Interactive demo with full flow
 */
export const InteractiveDemo = () => {
  const [items, setItems] = useState<ChatItem[]>([
    {
      type: 'message',
      id: '1',
      props: {
        content: "Welcome! I'm here to help you learn English. Let me get to know you first.",
        sender: 'ai',
        showTranslate: true,
      },
    },
    {
      type: 'survey',
      id: '2',
      props: {
        question: "Of these musicians, who is your favorite?",
        options: [
          { id: 'beyonce', label: 'Beyoncé' },
          { id: 'blackpink', label: 'BLACKPINK' },
          { id: 'jay-chou', label: 'Jay Chou' },
          { id: 'taylor', label: 'Taylor Swift' },
          { id: 'none', label: 'None of these' },
        ],
        onSelect: handleMusicianSelect,
      },
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [inputDisabled, setInputDisabled] = useState(true)
  const [onboardingStep, setOnboardingStep] = useState(0)

  function handleMusicianSelect(opt: SurveyOption) {
    // Update survey to show selected
    setItems(prev => prev.map(item => {
      if (item.id === '2' && item.type === 'survey') {
        return {
          ...item,
          props: { ...item.props, selectedId: opt.id, disabled: true },
        }
      }
      return item
    }))

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setItems(prev => [
        ...prev,
        {
          type: 'message',
          id: '3',
          props: {
            content: `Great choice! ${opt.label} has some amazing songs for learning English.`,
            sender: 'ai',
            showTranslate: true,
          },
        },
        {
          type: 'survey',
          id: '4',
          props: {
            question: "What's your English level?",
            options: [
              { id: 'beginner', label: 'Beginner' },
              { id: 'intermediate', label: 'Intermediate' },
              { id: 'advanced', label: 'Advanced' },
            ],
            onSelect: handleLevelSelect,
          },
        },
      ])
      setOnboardingStep(1)
    }, 1000)
  }

  function handleLevelSelect(opt: SurveyOption) {
    setItems(prev => prev.map(item => {
      if (item.id === '4' && item.type === 'survey') {
        return {
          ...item,
          props: { ...item.props, selectedId: opt.id, disabled: true },
        }
      }
      return item
    }))

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setItems(prev => [
        ...prev,
        {
          type: 'message',
          id: '5',
          props: {
            content: `Perfect! I'll tailor content for ${opt.label.toLowerCase()} level learners. You can now type any question or ask me to explain song lyrics!`,
            sender: 'ai',
            showTranslate: true,
          },
        },
      ])
      setInputDisabled(false)
      setOnboardingStep(2)
    }, 1000)
  }

  function handleSend(message: string) {
    const newId = String(items.length + 1)
    setItems(prev => [
      ...prev,
      {
        type: 'message',
        id: newId,
        props: {
          content: message,
          sender: 'user',
        },
      },
    ])

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setItems(prev => [
        ...prev,
        {
          type: 'message',
          id: String(parseInt(newId) + 1),
          props: {
            content: "That's a great question! Let me help you understand that better...",
            sender: 'ai',
            showTranslate: true,
          },
        },
      ])
    }, 1500)
  }

  return (
    <ChatPage
      items={items}
      aiAvatarUrl="https://api.dicebear.com/7.x/bottts/svg?seed=scarlett"
      isTyping={isTyping}
      inputProps={{
        onSend: handleSend,
        disabled: inputDisabled,
        placeholder: inputDisabled ? 'Complete the survey above...' : 'Ask me anything...',
        onVoiceInput: () => console.log('Voice'),
      }}
    />
  )
}

/**
 * With upgrade button (Premium AI)
 */
export const WithUpgradeButton: Story = {
  args: {
    items: sampleConversation,
    title: 'Scarlett',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onBack: () => console.log('Back'),
    showUpgrade: true,
    onUpgrade: () => console.log('Upgrade clicked'),
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * Default Chat - 64k context window
 */
export const DefaultChat64k: Story = {
  args: {
    items: [
      {
        type: 'message',
        id: '1',
        props: {
          content: "Hello! I'm your Default Chat assistant with a larger 64k context window for longer conversations.",
          sender: 'ai',
          showTranslate: true,
          tokensUsed: 5200,
          maxTokens: 64000,
        },
      },
      {
        type: 'message',
        id: '2',
        props: {
          content: "That's great! So we can have much longer conversations?",
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '3',
        props: {
          content: "Exactly! With 64k tokens, we can maintain context from much more of our conversation history.",
          sender: 'ai',
          showTranslate: true,
          tokensUsed: 9800,
          maxTokens: 64000,
        },
      },
    ],
    title: 'Default Chat',
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=default',
    onBack: () => console.log('Back'),
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}

/**
 * Long conversation - tests scrolling
 */
export const LongConversation: Story = {
  args: {
    items: [
      ...sampleConversation,
      {
        type: 'message',
        id: '4',
        props: {
          content: "I love Taylor Swift's songs!",
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '5',
        props: {
          content: "Excellent choice! Taylor Swift's lyrics are known for being storytelling masterpieces. Let's look at 'All Too Well' - it's full of vivid imagery and emotional vocabulary.",
          sender: 'ai',
          showTranslate: true,
        },
      },
      {
        type: 'message',
        id: '6',
        props: {
          content: "What does 'vivid imagery' mean?",
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '7',
        props: {
          content: "'Vivid imagery' means creating very clear and detailed pictures in someone's mind using words. When writing is vivid, you can almost see, hear, or feel what's being described.",
          sender: 'ai',
          showTranslate: true,
          translation: "「ビビッドなイメージ」とは、言葉を使って誰かの心に非常に明確で詳細な絵を作り出すことを意味します。",
        },
      },
      {
        type: 'message',
        id: '8',
        props: {
          content: "That makes sense! Can you give me an example from a song?",
          sender: 'user',
        },
      },
      {
        type: 'message',
        id: '9',
        props: {
          content: "Sure! In 'All Too Well', Taylor sings 'autumn leaves falling down like pieces into place'. This creates vivid imagery - you can picture the orange and red leaves gently floating to the ground, like puzzle pieces finding their spot.",
          sender: 'ai',
          showTranslate: true,
        },
      },
    ],
    aiAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    inputProps: {
      onSend: (msg) => console.log('Sent:', msg),
    },
  },
}
