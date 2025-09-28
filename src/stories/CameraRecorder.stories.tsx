import type { Meta, StoryObj } from '@storybook/react-vite';
import { CameraRecorder } from '../components/ui/CameraRecorder';

const meta: Meta<typeof CameraRecorder> = {
  title: 'Content Creation/CameraRecorder',
  component: CameraRecorder,
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

// Sample segment data
const sampleSegment = {
  start: 30.879,
  end: 43.5,
  lyrics: [
    {
      lineIndex: 4,
      originalText: "I've got the blues on my mind",
      translatedText: "满脑子都是忧伤",
      start: 30.879,
      end: 36.639,
      wordCount: 7
    },
    {
      lineIndex: 5,
      originalText: "I just feel like crying all the time",
      translatedText: "我只想一直哭泣",
      start: 37.139,
      end: 43.5,
      wordCount: 8
    }
  ]
};

const longSegment = {
  start: 1.399,
  end: 29.539,
  lyrics: [
    {
      lineIndex: 0,
      originalText: "I never felt so lonesome before",
      translatedText: "我从未感到如此孤单",
      start: 1.399,
      end: 8.279,
      wordCount: 6
    },
    {
      lineIndex: 1,
      originalText: "My friend has quit me, he's gone for sure",
      translatedText: "我的朋友离开了我，真的走了",
      start: 9.42,
      end: 14.799,
      wordCount: 9
    },
    {
      lineIndex: 2,
      originalText: "He broke my heart, for I loved him true",
      translatedText: "他伤了我的心，因为我真心爱他",
      start: 16.299,
      end: 21.959,
      wordCount: 9
    },
    {
      lineIndex: 3,
      originalText: "So now I'm worried, lonesome, and blue",
      translatedText: "现在我忧心忡忡，孤单又忧郁",
      start: 23.239,
      end: 29.539,
      wordCount: 7
    }
  ]
};

export const Mobile: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/songs/song-1/song-1.mp3",
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onFlipCamera: () => console.log('Flip camera clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
};

export const WithLongSegment: Story = {
  args: {
    segment: longSegment,
    audioUrl: "/songs/song-1/song-1.mp3",
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onFlipCamera: () => console.log('Flip camera clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
};

export const Recording: Story = {
  args: {
    isRecording: true,
    segment: sampleSegment,
    audioUrl: "/songs/song-1/song-1.mp3",
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onFlipCamera: () => console.log('Flip camera clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
};

export const NoSegment: Story = {
  args: {
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onFlipCamera: () => console.log('Flip camera clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
};

export const Desktop: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/songs/song-1/song-1.mp3",
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    // No onFlipCamera for desktop
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

export const MobileWithFlash: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/songs/song-1/song-1.mp3",
    showFlash: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onFlipCamera: () => console.log('Flip camera clicked'),
    onFlash: () => console.log('Flash clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete - auto navigate'),
  },
};