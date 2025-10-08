import type { Meta, StoryObj } from '@storybook/react-vite'
import { Leaderboard } from '@/components/class/Leaderboard'

const meta = {
  title: 'Class/Leaderboard',
  component: Leaderboard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Leaderboard>

export default meta
type Story = StoryObj<typeof meta>

const sampleEntries = [
  {
    rank: 1,
    username: 'karaoke_king',
    score: 9850,
    avatarUrl: 'https://placebear.com/100/100',
  },
  {
    rank: 2,
    username: 'melody_master',
    score: 8720,
    avatarUrl: 'https://placebear.com/101/101',
  },
  {
    rank: 3,
    username: 'rhythm_queen',
    score: 7890,
    avatarUrl: 'https://placebear.com/102/102',
  },
  {
    rank: 4,
    username: 'vocal_hero',
    score: 6543,
    avatarUrl: 'https://placebear.com/103/103',
  },
]

const currentUserNotInTop4 = {
  rank: 15,
  username: 'you',
  score: 2340,
  avatarUrl: 'https://placebear.com/104/104',
  isCurrentUser: true,
}

const currentUserInTop4 = {
  rank: 2,
  username: 'melody_master',
  score: 8720,
  avatarUrl: 'https://placebear.com/101/101',
  isCurrentUser: true,
}

export const TopFourOnly: Story = {
  args: {
    entries: sampleEntries,
  },
}

export const WithCurrentUserRank15: Story = {
  args: {
    entries: sampleEntries,
    currentUser: currentUserNotInTop4,
  },
}

export const CurrentUserInTopFour: Story = {
  args: {
    entries: sampleEntries.map(e =>
      e.rank === 2 ? { ...e, isCurrentUser: true } : e
    ),
    currentUser: currentUserInTop4,
  },
}
