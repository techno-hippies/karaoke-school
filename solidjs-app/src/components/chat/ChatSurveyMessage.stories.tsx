import type { Meta, StoryObj } from 'storybook-solidjs'
import { ChatSurveyMessage } from './ChatSurveyMessage'

const meta: Meta<typeof ChatSurveyMessage> = {
  title: 'Chat/ChatSurveyMessage',
  component: ChatSurveyMessage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="max-w-2xl mx-auto p-4 bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ChatSurveyMessage>

// Default survey question
export const Default: Story = {
  args: {
    question: "What kind of music do you enjoy?",
    options: [
      { id: 'pop', label: 'Pop' },
      { id: 'rock', label: 'Rock' },
      { id: 'hiphop', label: 'Hip-Hop' },
      { id: 'electronic', label: 'Electronic' },
    ],
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onSelect: (option) => console.log('Selected:', option),
  },
}

// With avatar
export const WithAvatar: Story = {
  args: {
    question: "Who's your favorite artist?",
    options: [
      { id: 'taylor', label: 'Taylor Swift' },
      { id: 'weeknd', label: 'The Weeknd' },
      { id: 'drake', label: 'Drake' },
      { id: 'billie', label: 'Billie Eilish' },
    ],
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onSelect: (option) => console.log('Selected:', option),
  },
}

// With selected option
export const WithSelection: Story = {
  args: {
    question: "What's your preferred learning style?",
    options: [
      { id: 'visual', label: 'Visual (videos, images)' },
      { id: 'audio', label: 'Audio (listening)' },
      { id: 'reading', label: 'Reading (text)' },
      { id: 'practice', label: 'Practice (hands-on)' },
    ],
    selectedId: 'audio',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
    onSelect: (option) => console.log('Selected:', option),
  },
}

// Disabled after selection
export const DisabledAfterSelection: Story = {
  args: {
    question: "What's your age range?",
    options: [
      { id: '18-24', label: '18-24' },
      { id: '25-34', label: '25-34' },
      { id: '35-44', label: '35-44' },
      { id: '45+', label: '45+' },
    ],
    selectedId: '25-34',
    disabled: true,
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=scarlett',
  },
}

// Long question
export const LongQuestion: Story = {
  args: {
    question:
      "I'm curious about your interests! When you have some free time and want to relax, what type of content do you usually enjoy?",
    options: [
      { id: 'anime', label: 'Anime & Manga' },
      { id: 'games', label: 'Video Games' },
      { id: 'music', label: 'Music & Concerts' },
      { id: 'movies', label: 'Movies & TV Shows' },
    ],
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    onSelect: (option) => console.log('Selected:', option),
  },
}

// Violet personality survey
export const VioletSurvey: Story = {
  args: {
    question: "What's your favorite anime genre?",
    options: [
      { id: 'shonen', label: 'Shonen (action, adventure)' },
      { id: 'shoujo', label: 'Shoujo (romance, drama)' },
      { id: 'isekai', label: 'Isekai (fantasy worlds)' },
      { id: 'slice', label: 'Slice of Life' },
    ],
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=violet',
    onSelect: (option) => console.log('Selected:', option),
  },
}

// Multiple surveys in sequence
export const SurveySequence: Story = {
  render: () => (
    <div class="space-y-6">
      <ChatSurveyMessage
        question="First, what kind of music do you like?"
        options={[
          { id: 'pop', label: 'Pop' },
          { id: 'rock', label: 'Rock' },
          { id: 'hiphop', label: 'Hip-Hop' },
        ]}
        selectedId="pop"
        disabled={true}
        avatarUrl="https://api.dicebear.com/7.x/bottts/svg?seed=scarlett"
      />

      <ChatSurveyMessage
        question="Great choice! Who's your favorite pop artist?"
        options={[
          { id: 'taylor', label: 'Taylor Swift' },
          { id: 'ariana', label: 'Ariana Grande' },
          { id: 'dua', label: 'Dua Lipa' },
          { id: 'other', label: 'Someone else' },
        ]}
        avatarUrl="https://api.dicebear.com/7.x/bottts/svg?seed=scarlett"
        onSelect={(option) => console.log('Selected:', option)}
      />
    </div>
  ),
}
