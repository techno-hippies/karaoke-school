import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatSurveyMessage, type SurveyOption } from '@/components/chat/ChatSurveyMessage'

const meta = {
  title: 'Chat/ChatSurveyMessage',
  component: ChatSurveyMessage,
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
} satisfies Meta<typeof ChatSurveyMessage>

export default meta
type Story = StoryObj<typeof meta>

const musicianOptions: SurveyOption[] = [
  { id: 'beyonce', label: 'Beyoncé' },
  { id: 'blackpink', label: 'BLACKPINK' },
  { id: 'jay-chou', label: 'Jay Chou' },
  { id: 'beatles', label: 'The Beatles' },
  { id: 'none', label: 'None of these' },
]

const animeOptions: SurveyOption[] = [
  { id: 'death-note', label: 'Death Note' },
  { id: 'attack-on-titan', label: 'Attack on Titan' },
  { id: 'demon-slayer', label: 'Demon Slayer' },
  { id: 'one-piece', label: 'One Piece' },
  { id: 'none', label: 'None of these' },
]

const ageOptions: SurveyOption[] = [
  { id: 'under-18', label: 'Under 18' },
  { id: '18-24', label: '18-24' },
  { id: '25-34', label: '25-34' },
  { id: '35-44', label: '35-44' },
  { id: '45+', label: '45+' },
]

/**
 * Favorite musician survey
 */
export const FavoriteMusician: Story = {
  args: {
    question: "Of these musicians, who is your favorite?",
    options: musicianOptions,
    onSelect: (opt) => console.log('Selected:', opt),
  },
}

/**
 * Favorite anime survey
 */
export const FavoriteAnime: Story = {
  args: {
    question: "Of these anime, which is your favorite?",
    options: animeOptions,
    onSelect: (opt) => console.log('Selected:', opt),
  },
}

/**
 * Age range survey
 */
export const AgeRange: Story = {
  args: {
    question: "What's your age range? (This helps us personalize content)",
    options: ageOptions,
    onSelect: (opt) => console.log('Selected:', opt),
  },
}

/**
 * With selection made
 */
export const Selected: Story = {
  args: {
    question: "Of these musicians, who is your favorite?",
    options: musicianOptions,
    selectedId: 'blackpink',
    disabled: true,
  },
}

/**
 * With custom avatar
 */
export const WithAvatar: Story = {
  args: {
    question: "Let's get to know you! What kind of music do you enjoy?",
    options: musicianOptions,
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai-tutor',
  },
}

/**
 * Interactive survey
 */
export const Interactive = () => {
  const [selected, setSelected] = useState<string | undefined>()

  return (
    <ChatSurveyMessage
      question="Of these musicians, who is your favorite?"
      options={musicianOptions}
      selectedId={selected}
      disabled={!!selected}
      onSelect={(opt) => {
        setSelected(opt.id)
        console.log('User selected:', opt.label)
      }}
    />
  )
}

/**
 * Full onboarding flow
 */
export const OnboardingFlow = () => {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const handleSelect = (key: string, _opt: SurveyOption) => {
    setAnswers(prev => ({ ...prev, [key]: _opt.id }))
    setTimeout(() => setStep(s => s + 1), 500)
  }

  return (
    <div className="space-y-4">
      <ChatSurveyMessage
        question="Welcome! Let's personalize your learning. Of these musicians, who is your favorite?"
        options={musicianOptions}
        selectedId={answers.musician}
        disabled={!!answers.musician}
        onSelect={(opt) => handleSelect('musician', opt)}
      />

      {step >= 1 && (
        <ChatSurveyMessage
          question="Great choice! Now, of these anime, which is your favorite?"
          options={animeOptions}
          selectedId={answers.anime}
          disabled={!!answers.anime}
          onSelect={(opt) => handleSelect('anime', opt)}
        />
      )}

      {step >= 2 && (
        <ChatSurveyMessage
          question="Almost done! What's your age range?"
          options={ageOptions}
          selectedId={answers.age}
          disabled={!!answers.age}
          onSelect={(opt) => handleSelect('age', opt)}
        />
      )}

      {step >= 3 && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-foreground">AI</span>
          </div>
          <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-secondary text-secondary-foreground">
            Thanks! I'll customize your learning experience based on your preferences.
          </div>
        </div>
      )}
    </div>
  )
}
