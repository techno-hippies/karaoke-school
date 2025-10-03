import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipPickerPage } from '../components/clips/ClipPickerPage';
import type { ClipMetadata } from '../types/song';

const meta: Meta<typeof ClipPickerPage> = {
  title: 'Clips/ClipPickerPage',
  component: ClipPickerPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample clips for a song
const sampleClips: ClipMetadata[] = [
  {
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
  },
  {
    id: 'down-home-blues-chorus',
    title: 'Down Home Blues',
    artist: 'Ethel Waters',
    sectionType: 'Chorus',
    sectionIndex: 0,
    duration: 15,
    audioUrl: '/clips/down-home-blues-chorus.mp3',
    instrumentalUrl: '/clips/down-home-blues-chorus-instrumental.mp3',
    thumbnailUrl: '',
    difficultyLevel: 2,
    wordsPerSecond: 2.0,
    lineTimestamps: [],
    totalLines: 2,
    languages: ['en']
  },
  {
    id: 'down-home-blues-chorus-2',
    title: 'Down Home Blues',
    artist: 'Ethel Waters',
    sectionType: 'Chorus',
    sectionIndex: 1,
    duration: 15,
    audioUrl: '/clips/down-home-blues-chorus-2.mp3',
    instrumentalUrl: '/clips/down-home-blues-chorus-2-instrumental.mp3',
    thumbnailUrl: '',
    difficultyLevel: 2,
    wordsPerSecond: 2.0,
    lineTimestamps: [],
    totalLines: 2,
    languages: ['en']
  }
];

export const Default: Story = {
  args: {
    clips: sampleClips,
    yourScore: 87,
    topScore: 95,
    topUser: 'alice.eth',
    songTitle: 'Down Home Blues',
    artist: 'Ethel Waters',
    thumbnailUrl: 'https://picsum.photos/seed/song1/800/800',
    isExternal: false,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    onClipSelect: (clip) => {
      console.log('Clip selected:', clip);
      alert(`Selected: ${clip.sectionType}`);
    },
    onBack: () => {
      console.log('Back clicked');
      alert('Back clicked');
    },
    onViewLeaderboard: () => {
      console.log('View leaderboard clicked');
      alert('View Leaderboard');
    },
    onPlaySong: () => {
      console.log('Play song clicked');
      alert('Playing song locally');
    }
  }
};

export const NoClips: Story = {
  args: {
    clips: [],
    yourScore: 0,
    topScore: 0,
    onClipSelect: (clip) => {
      console.log('Clip selected:', clip);
    },
    onBack: () => {
      console.log('Back clicked');
    }
  }
};

export const NoScoresYet: Story = {
  args: {
    clips: sampleClips,
    songTitle: 'Down Home Blues',
    artist: 'Ethel Waters',
    thumbnailUrl: 'https://picsum.photos/seed/song1/800/800',
    onClipSelect: (clip) => {
      console.log('Clip selected:', clip);
      alert(`Selected: ${clip.sectionType}`);
    },
    onBack: () => {
      console.log('Back clicked');
    }
  }
};

export const YoureTheLeader: Story = {
  args: {
    clips: sampleClips,
    yourScore: 95,
    topScore: 95,
    topUser: 'You',
    songTitle: 'Down Home Blues',
    artist: 'Ethel Waters',
    thumbnailUrl: 'https://picsum.photos/seed/song1/800/800',
    isExternal: false,
    onClipSelect: (clip) => {
      console.log('Clip selected:', clip);
      alert(`Selected: ${clip.sectionType}`);
    },
    onBack: () => {
      console.log('Back clicked');
    },
    onViewLeaderboard: () => {
      console.log('View leaderboard clicked');
      alert('View Leaderboard');
    },
    onPlaySong: () => {
      alert('Playing song');
    }
  }
};

export const ExternalSong: Story = {
  args: {
    clips: sampleClips,
    yourScore: 87,
    topScore: 95,
    topUser: 'alice.eth',
    songTitle: 'External Track',
    artist: 'SoundCloud Artist',
    thumbnailUrl: 'https://picsum.photos/seed/song2/800/800',
    isExternal: true,
    externalSongLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/example' },
      { label: 'Maid.zone', url: 'https://maid.zone/example' }
    ],
    externalLyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/example' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/example' },
      { label: 'Dumb', url: 'https://dm.vern.cc/example' }
    ],
    onClipSelect: (clip) => {
      console.log('Clip selected:', clip);
      alert(`Selected: ${clip.sectionType}`);
    },
    onBack: () => {
      console.log('Back clicked');
    },
    onViewLeaderboard: () => {
      console.log('View leaderboard clicked');
    },
    onPlaySong: () => {
      console.log('Play song clicked');
    }
  }
};
