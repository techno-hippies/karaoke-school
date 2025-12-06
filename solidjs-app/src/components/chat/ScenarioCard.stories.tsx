import type { Meta, StoryObj } from 'storybook-solidjs'
import { ScenarioCard } from './ScenarioCard'

const meta: Meta<typeof ScenarioCard> = {
  title: 'Chat/ScenarioCard',
  component: ScenarioCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="max-w-md mx-auto p-4 bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ScenarioCard>

// Default scenario with image
export const WithImage: Story = {
  args: {
    id: 'scarlett-chat',
    title: 'Chat',
    character: 'Scarlett',
    description: 'Have a casual conversation with Scarlett, your music-loving AI tutor.',
    image: '/images/scarlett/default.webp',
    onClick: () => console.log('Card clicked'),
  },
}

// Gradient placeholder (no image)
export const WithGradient: Story = {
  args: {
    id: 'violet-chat',
    title: 'Chat',
    character: 'Violet',
    description: 'Chat with Violet about anime, gaming, and Japanese culture.',
    gradient: ['#8b5cf6', '#d946ef'],
    onClick: () => console.log('Card clicked'),
  },
}

// Adult content badge
export const AdultContent: Story = {
  args: {
    id: 'violet-nightclub',
    title: 'Late Night',
    character: 'Violet',
    description: 'A more mature conversation setting for adult learners.',
    gradient: ['#ef4444', '#f97316'],
    isAdult: true,
    onClick: () => console.log('Card clicked'),
  },
}

// Roleplay scenario
export const RoleplayScenario: Story = {
  args: {
    id: 'scarlett-surfing',
    title: 'Beach Day',
    character: 'Scarlett',
    description: "Join Scarlett for a day at the beach! Practice casual conversation while she teaches you surfing.",
    image: '/images/scarlett/beach.webp',
    onClick: () => console.log('Card clicked'),
  },
}

// Without character name
export const NoCharacter: Story = {
  args: {
    id: 'general-chat',
    title: 'Language Practice',
    description: 'Practice English conversation with an AI tutor.',
    gradient: ['#3b82f6', '#06b6d4'],
    onClick: () => console.log('Card clicked'),
  },
}

// Grid of scenarios
export const ScenarioGrid: Story = {
  render: () => (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ScenarioCard
        id="scarlett-chat"
        title="Chat"
        character="Scarlett"
        description="Casual conversation with your music-loving AI tutor."
        gradient={['#6366f1', '#8b5cf6']}
        onClick={() => console.log('Scarlett Chat')}
      />
      <ScenarioCard
        id="scarlett-cafe"
        title="Café"
        character="Scarlett"
        description="Meet Scarlett at a cozy café for language practice."
        gradient={['#f59e0b', '#d97706']}
        onClick={() => console.log('Scarlett Café')}
      />
      <ScenarioCard
        id="violet-chat"
        title="Chat"
        character="Violet"
        description="Chat about anime, gaming, and Japanese culture."
        gradient={['#8b5cf6', '#d946ef']}
        onClick={() => console.log('Violet Chat')}
      />
      <ScenarioCard
        id="violet-nightclub"
        title="Late Night"
        character="Violet"
        description="A more mature conversation for adult learners."
        gradient={['#ef4444', '#f97316']}
        isAdult={true}
        onClick={() => console.log('Violet Late Night')}
      />
    </div>
  ),
  decorators: [
    (Story) => (
      <div class="max-w-4xl mx-auto p-4 bg-background">
        <Story />
      </div>
    ),
  ],
}
