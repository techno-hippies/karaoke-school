import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ScenarioPicker, type Scenario } from '@/components/chat/PersonalityPicker'
import { ScenarioCard } from '@/components/chat/PersonalityCard'

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

// Sample scenarios
const sampleScenarios: Scenario[] = [
  {
    id: 'default',
    title: 'Scarlett — Chat',
    description: "Scarlett's default personality with context about your favorite songs, study habits, and learning goals. Great for practice tips and casual conversation.",
    gradient: ['#6366f1', '#8b5cf6'],
  },
  {
    id: 'beach-bar',
    title: 'Beach Bar',
    character: 'Scarlett',
    description: "Sunset drinks at a beach bar in Bali. She notices you practicing English with K School and sits down next to you, curious about what you're learning.",
    gradient: ['#f97316', '#eab308'],
    isAdult: true,
  },
  {
    id: 'coffee-shop',
    title: 'Coffee Shop',
    character: 'Scarlett',
    description: "Rainy afternoon at a cozy café in Chiang Mai. She's working on her laptop at the next table, and you overhear her humming a Taylor Swift song under her breath.",
    gradient: ['#78716c', '#a8a29e'],
  },
]

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

/**
 * Scenario picker - Mobile view
 */
export const ScenarioPickerMobile: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ScenarioPicker
        scenarios={sampleScenarios}
        onSelect={(s) => alert(`Selected: ${s.title}`)}
      />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

// Scenarios grouped by character (no "with X" since sections make it clear)
const scarlettScenarios: Scenario[] = [
  {
    id: 'scarlett-chat',
    title: 'Just Chat',
    description: "Talk about your favorite songs, get practice tips, or just hang out. She knows what you've been learning and can help you improve.",
    image: '/images/scarlett/default.webp',
  },
  {
    id: 'scarlett-surfing',
    title: 'Surfing in Bali',
    description: "Late afternoon on Kuta Beach. You both just came out of the water after a surf session. She's wringing out her hair, still catching her breath.",
    image: '/images/scarlett/beach.webp',
  },
  {
    id: 'scarlett-cafe',
    title: 'Cafe in Paris',
    description: "Late afternoon at a tiny café in Le Marais. Golden light through the window. You struggled with the French menu and she offered to help.",
    image: '/images/scarlett/cafe.webp',
  },
]

const violetScenarios: Scenario[] = [
  {
    id: 'violet-chat',
    title: 'Just Chat',
    description: "Shy at first, but she warms up fast. Talk music, get feedback on your practice, or just vibe. She remembers what you've been working on.",
    image: '/images/violet/default.webp',
  },
  {
    id: 'violet-nightclub',
    title: 'Nightclub in Seoul',
    description: "2am at an underground club in Hongdae. She just finished a guest DJ set and she's cooling down at the bar, still buzzing from the energy.",
    image: '/images/violet/nightclub.webp',
    isAdult: true,
  },
  {
    id: 'violet-ramen',
    title: 'Late Night Ramen',
    description: "3am at a tiny ramen shop in Shibuya. She's alone at the counter after a long night, scrolling through memes. That weird 3am energy.",
    image: '/images/violet/ramen.webp',
  },
]

/**
 * Scenario picker grouped by character - Mobile (stacked)
 */
export const ScenarioPickerGrouped: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scarlett Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Scarlett</h2>
          <div className="space-y-3">
            {scarlettScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => alert(`Selected: ${scenario.title}`)}
              />
            ))}
          </div>
        </section>

        {/* Violet Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Violet</h2>
          <div className="space-y-3">
            {violetScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => alert(`Selected: ${scenario.title}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Scenario picker grouped - Desktop (2 columns)
 */
export const ScenarioPickerGroupedDesktop: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scarlett Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Scarlett</h2>
          <div className="space-y-3">
            {scarlettScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => alert(`Selected: ${scenario.title}`)}
              />
            ))}
          </div>
        </section>

        {/* Violet Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Violet</h2>
          <div className="space-y-3">
            {violetScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => alert(`Selected: ${scenario.title}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  ),
}
