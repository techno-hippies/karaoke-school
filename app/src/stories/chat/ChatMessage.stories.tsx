import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatMessage } from '@/components/chat/ChatMessage'

// Sample images for stories
const SAMPLE_IMAGES = {
  idiom: 'https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?w=512&h=512&fit=crop',
  nature: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=512&h=512&fit=crop',
  abstract: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=512&h=512&fit=crop',
}

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
    tokensUsed: 8500,
    maxTokens: 32000,
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
    tokensUsed: 4200,
    maxTokens: 32000,
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
    tokensUsed: 15600,
    maxTokens: 32000,
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
    tokensUsed: 22000,
    maxTokens: 32000,
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
    tokensUsed: 29000,
    maxTokens: 32000,
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
    tokensUsed: 30500,
    maxTokens: 32000,
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
        tokensUsed={2500}
        maxTokens={32000}
      />
      <ChatMessage
        content="Yes! Can we practice with song lyrics?"
        sender="user"
      />
      <ChatMessage
        content="Of course! Song lyrics are a great way to learn. Which artist do you like?"
        sender="ai"
        showTranslate
        tokensUsed={5800}
        maxTokens={32000}
      />
      <ChatMessage
        content="I love Taylor Swift!"
        sender="user"
      />
    </div>
  ),
}

/**
 * Context indicator at different levels
 */
export const ContextLevels: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="mb-2 text-sm text-muted-foreground">Low usage (26%)</div>
      <ChatMessage
        content="This conversation is just getting started!"
        sender="ai"
        showTranslate
        tokensUsed={8500}
        maxTokens={32000}
      />
      <div className="mt-6 mb-2 text-sm text-muted-foreground">Medium usage (48%)</div>
      <ChatMessage
        content="We've been chatting for a while now."
        sender="ai"
        showTranslate
        tokensUsed={15600}
        maxTokens={32000}
      />
      <div className="mt-6 mb-2 text-sm text-muted-foreground">High usage (75% - warning threshold)</div>
      <ChatMessage
        content="The context is getting pretty full now."
        sender="ai"
        showTranslate
        tokensUsed={24000}
        maxTokens={32000}
      />
      <div className="mt-6 mb-2 text-sm text-muted-foreground">Very high usage (95% - critical)</div>
      <ChatMessage
        content="Almost at the limit - consider starting a new chat!"
        sender="ai"
        showTranslate
        tokensUsed={30500}
        maxTokens={32000}
      />
      <div className="mt-6 mb-2 text-muted-foreground">Default Chat with 64k tokens (48%)</div>
      <ChatMessage
        content="Default Chat has a larger context window!"
        sender="ai"
        showTranslate
        tokensUsed={30500}
        maxTokens={64000}
      />
    </div>
  ),
}

/**
 * AI message with visualize button
 */
export const WithVisualizeButton: Story = {
  args: {
    content: "The idiom 'break the ice' means to initiate conversation in a social setting, often to reduce tension or awkwardness.",
    sender: 'ai',
    showTranslate: true,
    showVisualize: true,
    onVisualize: () => console.log('Visualize clicked'),
  },
}

/**
 * AI message while generating image
 */
export const GeneratingImage: Story = {
  args: {
    content: "The idiom 'break the ice' means to initiate conversation in a social setting.",
    sender: 'ai',
    showVisualize: true,
    isGeneratingImage: true,
  },
}

/**
 * AI message with generated image thumbnail
 * Click the thumbnail to open the lightbox
 */
export const WithGeneratedImage: Story = {
  args: {
    content: "Here's a visual representation of 'break the ice' - imagine someone literally breaking through ice to reach others!",
    sender: 'ai',
    showVisualize: true,
    imageUrl: SAMPLE_IMAGES.idiom,
    onRegenerateImage: () => console.log('Regenerate clicked'),
  },
}

/**
 * Interactive image generation flow
 * Click "Visualize" to simulate generating an image
 */
export const ImageGenerationFlow: Story = {
  render: function ImageGenerationFlowStory() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)

    const handleVisualize = () => {
      setIsGenerating(true)
      // Simulate API call
      setTimeout(() => {
        setImageUrl(SAMPLE_IMAGES.abstract)
        setIsGenerating(false)
      }, 2000)
    }

    const handleRegenerate = () => {
      setIsGenerating(true)
      setImageUrl(undefined)
      // Simulate API call with different image
      setTimeout(() => {
        setImageUrl(SAMPLE_IMAGES.nature)
        setIsGenerating(false)
      }, 2000)
    }

    return (
      <ChatMessage
        content="Let me explain the concept of 'serendipity' - it's when you find something wonderful by accident, like stumbling upon a hidden garden while lost in a new city."
        sender="ai"
        showVisualize
        imageUrl={imageUrl}
        isGeneratingImage={isGenerating}
        onVisualize={handleVisualize}
        onRegenerateImage={handleRegenerate}
      />
    )
  },
}

/**
 * Full conversation with image generation
 */
export const ConversationWithImages: Story = {
  render: () => (
    <div className="space-y-4">
      <ChatMessage
        content="Can you explain the idiom 'a picture is worth a thousand words'?"
        sender="user"
      />
      <ChatMessage
        content="This idiom means that a single image can convey complex ideas more effectively than a lengthy description. It highlights the power of visual communication."
        sender="ai"
        showTranslate
        showVisualize
        imageUrl={SAMPLE_IMAGES.abstract}
      />
      <ChatMessage
        content="That's helpful! Can you show me another example?"
        sender="user"
      />
      <ChatMessage
        content="Here's another visual - think of how a photograph of a sunset can evoke emotions that would take paragraphs to describe in words."
        sender="ai"
        showTranslate
        showVisualize
        imageUrl={SAMPLE_IMAGES.nature}
      />
    </div>
  ),
}

/**
 * Message with all features: translate, audio, visualize
 */
export const AllFeatures: Story = {
  args: {
    content: "The phrase 'carpe diem' is Latin for 'seize the day' - it encourages us to make the most of the present moment.",
    sender: 'ai',
    showTranslate: true,
    hasAudio: true,
    showVisualize: true,
    imageUrl: SAMPLE_IMAGES.idiom,
    translation: "「カルペ・ディエム」はラテン語で「今日を摘め」という意味です - 今この瞬間を最大限に活かすことを勧めています。",
    tokensUsed: 12000,
    maxTokens: 32000,
    onPlayAudio: () => console.log('Play audio'),
    onRegenerateImage: () => console.log('Regenerate'),
  },
}
