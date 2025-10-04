/**
 * TrendingSection Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TrendingSection } from './TrendingSection';
import { ContentSource } from '@/types/song';
import type { TrendingSong } from '@/services/TrendingService';

const meta: Meta<typeof TrendingSection> = {
  title: 'Components/TrendingSection',
  component: TrendingSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TrendingSection>;

// Sample trending data
const mockHourlyTrending: TrendingSong[] = [
  {
    source: ContentSource.Genius,
    songId: '123456',
    trendingScore: 850,
    clicks: 25,
    plays: 40,
    completions: 15,
    lastUpdated: Math.floor(Date.now() / 1000) - 1800 // 30 min ago
  },
  {
    source: ContentSource.Native,
    songId: 'heat-of-the-night',
    trendingScore: 720,
    clicks: 18,
    plays: 35,
    completions: 12,
    lastUpdated: Math.floor(Date.now() / 1000) - 2100
  },
  {
    source: ContentSource.Genius,
    songId: '789012',
    trendingScore: 650,
    clicks: 22,
    plays: 28,
    completions: 10,
    lastUpdated: Math.floor(Date.now() / 1000) - 2400
  },
  {
    source: ContentSource.Native,
    songId: 'down-home-blues',
    trendingScore: 540,
    clicks: 15,
    plays: 25,
    completions: 8,
    lastUpdated: Math.floor(Date.now() / 1000) - 2700
  },
  {
    source: ContentSource.Genius,
    songId: '345678',
    trendingScore: 480,
    clicks: 12,
    plays: 22,
    completions: 7,
    lastUpdated: Math.floor(Date.now() / 1000) - 3000
  }
];

const mockDailyTrending: TrendingSong[] = [
  {
    source: ContentSource.Native,
    songId: 'heat-of-the-night',
    trendingScore: 2850,
    clicks: 85,
    plays: 140,
    completions: 45,
    lastUpdated: Math.floor(Date.now() / 1000) - 7200
  },
  {
    source: ContentSource.Genius,
    songId: '123456',
    trendingScore: 2420,
    clicks: 72,
    plays: 120,
    completions: 38,
    lastUpdated: Math.floor(Date.now() / 1000) - 10800
  },
  {
    source: ContentSource.Genius,
    songId: '789012',
    trendingScore: 1850,
    clicks: 55,
    plays: 95,
    completions: 28,
    lastUpdated: Math.floor(Date.now() / 1000) - 14400
  }
];

const mockWeeklyTrending: TrendingSong[] = [
  {
    source: ContentSource.Native,
    songId: 'heat-of-the-night',
    trendingScore: 12850,
    clicks: 385,
    plays: 640,
    completions: 185,
    lastUpdated: Math.floor(Date.now() / 1000) - 86400
  },
  {
    source: ContentSource.Genius,
    songId: '123456',
    trendingScore: 10420,
    clicks: 312,
    plays: 520,
    completions: 148,
    lastUpdated: Math.floor(Date.now() / 1000) - 172800
  }
];

export const WithTrending: Story = {
  args: {
    hourly: mockHourlyTrending,
    daily: mockDailyTrending,
    weekly: mockWeeklyTrending,
    onSongClick: (song) => console.log('Clicked:', song),
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    hourly: [],
    daily: [],
    weekly: [],
  },
};

export const OnlyHourly: Story = {
  args: {
    hourly: mockHourlyTrending,
    daily: [],
    weekly: [],
  },
};
