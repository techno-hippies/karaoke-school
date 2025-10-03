import type { Meta, StoryObj } from '@storybook/react-vite';
import { ModeSelectorPage } from '../components/create/ModeSelectorPage';
import type { ClipMetadata } from '../types/song';

const meta: Meta<typeof ModeSelectorPage> = {
  title: 'Content Creation/ModeSelectorPage',
  component: ModeSelectorPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleClip: ClipMetadata = {
  id: 'down-home-blues-verse',
  title: 'Down Home Blues',
  artist: 'Ethel Waters',
  sectionType: 'Verse',
  sectionIndex: 0,
  duration: 28,
  audioUrl: '/clips/down-home-blues-verse.mp3',
  instrumentalUrl: '/clips/down-home-blues-verse-instrumental.mp3',
  thumbnailUrl: '',
  difficultyLevel: 3,
  wordsPerSecond: 2.5,
  lineTimestamps: [],
  totalLines: 4,
  languages: ['en']
};

export const Default: Story = {
  args: {
    clip: sampleClip,
    onModeSelect: (mode) => console.log('Mode selected:', mode),
    onBack: () => console.log('Back clicked'),
  },
};

export const WithoutClip: Story = {
  args: {
    onModeSelect: (mode) => console.log('Mode selected:', mode),
    onBack: () => console.log('Back clicked'),
  },
};

export const DifferentSong: Story = {
  args: {
    clip: {
      ...sampleClip,
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      sectionType: 'Chorus',
      difficultyLevel: 8,
    },
    onModeSelect: (mode) => console.log('Mode selected:', mode),
    onBack: () => console.log('Back clicked'),
  },
};
