import type { Meta, StoryObj } from '@storybook/react';
import { SongPickerPage } from '../components/create/SongPickerPage';

const meta: Meta<typeof SongPickerPage> = {
  title: 'Content Creation/SongPickerPage',
  component: SongPickerPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: () => console.log('Back clicked'),
    onSongSelect: (song) => console.log('Song selected:', song),
  },
};

export const Loading: Story = {
  args: {
    onBack: () => console.log('Back clicked'),
    onSongSelect: (song) => console.log('Song selected:', song),
  },
};

export const Desktop: Story = {
  args: {
    onBack: () => console.log('Back clicked'),
    onSongSelect: (song) => console.log('Song selected:', song),
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};