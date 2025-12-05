import type { Meta, StoryObj } from '@storybook/react'
import { ScenarioCard } from '@/components/chat/PersonalityCard'

const meta = {
  title: 'Chat/ScenarioCard',
  component: ScenarioCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ScenarioCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Scarlett - Just Chat
 */
export const ScarlettChat: Story = {
  args: {
    id: 'scarlett-chat',
    title: 'Just Chat',
    description: "Talk about your favorite songs, get practice tips, or just hang out. She knows what you've been learning and can help you improve.",
    image: '/images/scarlett/default.webp',
  },
}

/**
 * Scarlett - Surfing in Bali
 */
export const ScarlettSurfing: Story = {
  args: {
    id: 'scarlett-surfing',
    title: 'Surfing in Bali',
    description: "Late afternoon on Kuta Beach. You both just came out of the water after a surf session. She's wringing out her hair, still catching her breath.",
    image: '/images/scarlett/beach.webp',
  },
}

/**
 * Scarlett - Cafe in Paris
 */
export const ScarlettCafe: Story = {
  args: {
    id: 'scarlett-cafe',
    title: 'Cafe in Paris',
    description: "Late afternoon at a tiny café in Le Marais. Golden light through the window. You struggled with the French menu and she offered to help.",
    image: '/images/scarlett/cafe.webp',
  },
}

/**
 * Violet - Nightclub in Seoul
 */
export const VioletNightclub: Story = {
  args: {
    id: 'violet-nightclub',
    title: 'Nightclub in Seoul',
    description: "2am at an underground club in Hongdae. She just finished a guest DJ set and she's cooling down at the bar, still buzzing from the energy.",
    image: '/images/violet/nightclub.webp',
    isAdult: true,
  },
}

/**
 * Violet - Late Night Ramen
 */
export const VioletRamen: Story = {
  args: {
    id: 'violet-ramen',
    title: 'Late Night Ramen',
    description: "3am at a tiny ramen shop in Shibuya. She's alone at the counter after a long night, scrolling through memes. That weird 3am energy.",
    image: '/images/violet/ramen.webp',
  },
}

/**
 * All Scarlett scenarios stacked
 */
export const AllScarlettScenarios: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm">
      <ScenarioCard
        id="scarlett-chat"
        title="Just Chat"
        description="Talk about your favorite songs, get practice tips, or just hang out. She knows what you've been learning and can help you improve."
        image="/images/scarlett/default.webp"
      />
      <ScenarioCard
        id="scarlett-surfing"
        title="Surfing in Bali"
        description="Late afternoon on Kuta Beach. You both just came out of the water after a surf session. She's wringing out her hair, still catching her breath."
        image="/images/scarlett/beach.webp"
      />
      <ScenarioCard
        id="scarlett-cafe"
        title="Cafe in Paris"
        description="Late afternoon at a tiny café in Le Marais. Golden light through the window. You struggled with the French menu and she offered to help."
        image="/images/scarlett/cafe.webp"
      />
    </div>
  ),
}
