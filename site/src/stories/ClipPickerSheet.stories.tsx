import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ClipPickerSheet } from '../components/clips/ClipPickerSheet';
import { Button } from '../components/ui/button';
import type { ClipMetadata } from '../types/song';

const meta: Meta<typeof ClipPickerSheet> = {
  title: 'Clips/ClipPickerSheet',
  component: ClipPickerSheet,
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

const ClipPickerSheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <Button onClick={() => setOpen(true)}>Open Clip Picker</Button>
      <ClipPickerSheet
        open={open}
        onOpenChange={setOpen}
        clips={sampleClips}
        onClipSelect={(clip) => {
          console.log('Clip selected:', clip);
          alert(`Selected: ${clip.sectionType}`);
        }}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => <ClipPickerSheetDemo />,
};

const ClipPickerSheetOpenByDefault = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <div className="text-white text-center">
        <p className="mb-4">Sheet opens automatically</p>
        <Button onClick={() => setOpen(true)}>Reopen Clip Picker</Button>
      </div>
      <ClipPickerSheet
        open={open}
        onOpenChange={setOpen}
        clips={sampleClips}
        onClipSelect={(clip) => {
          console.log('Clip selected:', clip);
          alert(`Selected: ${clip.sectionType}`);
        }}
      />
    </div>
  );
};

export const OpenByDefault: Story = {
  render: () => <ClipPickerSheetOpenByDefault />,
};
