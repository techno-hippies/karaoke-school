import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipView } from '../components/clips/ClipView';

const meta: Meta<typeof ClipView> = {
  title: 'Clips/ClipView',
  component: ClipView,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default ClipView with a populated leaderboard
 */
export const Default: Story = {
  args: {
    songTitle: "Bohemian Rhapsody",
    artist: "Queen",
    difficulty: 8,
    wordsPerSecond: 3.2,
    leaderboard: [
      {
        username: "karaoke_master",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        score: 98
      },
      {
        username: "vocal_hero",
        walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        score: 95
      },
      {
        walletAddress: "0x9876543210fedcba9876543210fedcba98765432",
        score: 92
      },
      {
        username: "sing_it_loud",
        walletAddress: "0xfedcba9876543210fedcba9876543210fedcba98",
        score: 89
      },
      {
        username: "melody_maker",
        walletAddress: "0x1111222233334444555566667777888899990000",
        score: 87
      },
      {
        walletAddress: "0xaaaa0000bbbb1111cccc2222dddd3333eeee4444",
        score: 85
      },
      {
        username: "pitch_perfect",
        walletAddress: "0x5555666677778888999900001111222233334444",
        score: 82
      },
      {
        username: "rhythm_king",
        walletAddress: "0xbbbbccccddddeeeeffffaaaabbbbccccddddeeee",
        score: 79
      },
      {
        walletAddress: "0x1010101010101010101010101010101010101010",
        score: 76
      },
      {
        username: "tune_champ",
        walletAddress: "0x2020202020202020202020202020202020202020",
        score: 73
      }
    ],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};

/**
 * Empty leaderboard - no scores yet
 */
export const EmptyLeaderboard: Story = {
  args: {
    songTitle: "Yesterday",
    artist: "The Beatles",
    difficulty: 4,
    wordsPerSecond: 2.1,
    leaderboard: [],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};

/**
 * High difficulty song with fast words per second
 */
export const HighDifficulty: Story = {
  args: {
    songTitle: "Rap God",
    artist: "Eminem",
    difficulty: 10,
    wordsPerSecond: 8.5,
    leaderboard: [
      {
        username: "rap_legend",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        score: 87
      },
      {
        walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        score: 72
      },
      {
        username: "fast_talker",
        walletAddress: "0x9876543210fedcba9876543210fedcba98765432",
        score: 65
      }
    ],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};

/**
 * Low difficulty beginner-friendly song
 */
export const LowDifficulty: Story = {
  args: {
    songTitle: "Twinkle Twinkle Little Star",
    artist: "Traditional",
    difficulty: 1,
    wordsPerSecond: 1.2,
    leaderboard: [
      {
        username: "beginner_1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        score: 100
      },
      {
        username: "beginner_2",
        walletAddress: "0x2222222222222222222222222222222222222222",
        score: 99
      },
      {
        username: "beginner_3",
        walletAddress: "0x3333333333333333333333333333333333333333",
        score: 98
      }
    ],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};

/**
 * Mixed leaderboard with Lens usernames and wallet addresses
 */
export const MixedLeaderboard: Story = {
  args: {
    songTitle: "Let It Be",
    artist: "The Beatles",
    difficulty: 5,
    wordsPerSecond: 2.8,
    leaderboard: [
      {
        username: "karaoke.lens",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        score: 95
      },
      {
        walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        score: 90
      },
      {
        username: "singer.lens",
        walletAddress: "0x9876543210fedcba9876543210fedcba98765432",
        score: 88
      },
      {
        walletAddress: "0xfedcba9876543210fedcba9876543210fedcba98",
        score: 85
      },
      {
        username: "musician.lens",
        walletAddress: "0x1111222233334444555566667777888899990000",
        score: 82
      }
    ],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};

/**
 * Long song title that tests text wrapping
 */
export const LongTitle: Story = {
  args: {
    songTitle: "Supercalifragilisticexpialidocious - The Extended Version with Extra Long Title",
    artist: "Mary Poppins Original Broadway Cast",
    difficulty: 7,
    wordsPerSecond: 4.5,
    leaderboard: [
      {
        username: "broadway_star",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        score: 91
      }
    ],
    onClose: () => console.log('Close clicked'),
    onCover: () => console.log('Cover clicked')
  },
};
