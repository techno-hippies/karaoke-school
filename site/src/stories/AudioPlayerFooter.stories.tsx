import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AudioPlayerFooter } from '../components/audio/AudioPlayerFooter';

const meta: Meta<typeof AudioPlayerFooter> = {
  title: 'Audio/AudioPlayerFooter',
  component: AudioPlayerFooter,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const AudioPlayerDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <p className="text-white text-center">
        Audio player is fixed at the bottom
      </p>
      <AudioPlayerFooter
        thumbnailUrl="https://picsum.photos/seed/song1/200/200"
        title="Down Home Blues"
        artist="Ethel Waters"
        audioUrl="/clips/down-home-blues-verse.mp3"
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => <AudioPlayerDemo />,
};

const AudioPlayerWithoutThumbnail = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <p className="text-white text-center">
        Audio player without thumbnail
      </p>
      <AudioPlayerFooter
        title="Heat of the Night"
        artist="Scarlett X"
        audioUrl="/clips/down-home-blues-chorus.mp3"
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
      />
    </div>
  );
};

export const NoThumbnail: Story = {
  render: () => <AudioPlayerWithoutThumbnail />,
};

const AudioPlayerPlaying = () => {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <p className="text-white text-center">
        Auto-playing (click pause to stop)
      </p>
      <AudioPlayerFooter
        thumbnailUrl="https://picsum.photos/seed/song2/200/200"
        title="Down Home Blues"
        artist="Ethel Waters"
        audioUrl="/clips/down-home-blues-verse.mp3"
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
      />
    </div>
  );
};

export const Playing: Story = {
  render: () => <AudioPlayerPlaying />,
};

const AudioPlayerWithProgress = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-white mb-4">
          Click play to see progress bar filling
        </p>
        <p className="text-neutral-400 text-sm">
          (Using online audio sample)
        </p>
      </div>
      <AudioPlayerFooter
        thumbnailUrl="https://picsum.photos/seed/progress/200/200"
        title="Test Audio"
        artist="Sample Track"
        audioUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
      />
    </div>
  );
};

export const WithProgress: Story = {
  render: () => <AudioPlayerWithProgress />,
};
