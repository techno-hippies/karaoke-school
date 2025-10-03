import type { Meta, StoryObj } from '@storybook/react-vite';
import { LeaderboardList, type LeaderboardEntry } from '../components/clips/LeaderboardList';

const meta: Meta<typeof LeaderboardList> = {
  title: 'Clips/LeaderboardList',
  component: LeaderboardList,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#171717' },
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleEntries: LeaderboardEntry[] = [
  { rank: 1, user: '0x1234...5678', score: 95 },
  { rank: 2, user: '0xabcd...efab', score: 87 },
  { rank: 3, user: 'alice.eth', score: 82 },
  { rank: 4, user: '0x9876...5432', score: 78 },
  { rank: 5, user: 'bob.eth', score: 75 },
  { rank: 6, user: '0x5555...6666', score: 72 },
  { rank: 7, user: '0x7777...8888', score: 68 },
  { rank: 8, user: 'charlie.eth', score: 65 },
  { rank: 9, user: '0x9999...0000', score: 62 },
  { rank: 10, user: '0x1111...2222', score: 60 },
];

export const Default: Story = {
  args: {
    entries: sampleEntries,
  },
};

export const WithCurrentUser: Story = {
  args: {
    entries: sampleEntries.map((entry, i) =>
      i === 1 ? { ...entry, isCurrentUser: true } : entry
    ),
  },
};

export const Top3Only: Story = {
  args: {
    entries: sampleEntries.slice(0, 3),
  },
};

export const CurrentUserFirst: Story = {
  args: {
    entries: sampleEntries.map((entry, i) =>
      i === 0 ? { ...entry, isCurrentUser: true } : entry
    ),
  },
};
