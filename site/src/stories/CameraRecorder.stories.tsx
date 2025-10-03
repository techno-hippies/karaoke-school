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

// Sample segment data with word-level timestamps
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
      wordCount: 7,
      words: [
        { text: "I've", start: 30.879, end: 31.5 },
        { text: "got", start: 31.5, end: 32.0 },
        { text: "the", start: 32.0, end: 32.3 },
        { text: "blues", start: 32.3, end: 33.5 },
        { text: "on", start: 33.5, end: 34.0 },
        { text: "my", start: 34.0, end: 34.5 },
        { text: "mind", start: 34.5, end: 36.639 }
      ]
    },
    {
      lineIndex: 5,
      originalText: "I just feel like crying all the time",
      translatedText: "我只想一直哭泣",
      start: 37.139,
      end: 43.5,
      wordCount: 8,
      words: [
        { text: "I", start: 37.139, end: 37.5 },
        { text: "just", start: 37.5, end: 38.0 },
        { text: "feel", start: 38.0, end: 38.8 },
        { text: "like", start: 38.8, end: 39.5 },
        { text: "crying", start: 39.5, end: 40.5 },
        { text: "all", start: 40.5, end: 41.0 },
        { text: "the", start: 41.0, end: 41.3 },
        { text: "time", start: 41.3, end: 43.5 }
      ]
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
      wordCount: 6,
      words: [
        { text: "I", start: 1.399, end: 2.0 },
        { text: "never", start: 2.0, end: 3.5 },
        { text: "felt", start: 3.5, end: 4.5 },
        { text: "so", start: 4.5, end: 5.0 },
        { text: "lonesome", start: 5.0, end: 7.0 },
        { text: "before", start: 7.0, end: 8.279 }
      ]
    },
    {
      lineIndex: 1,
      originalText: "My friend has quit me, he's gone for sure",
      translatedText: "我的朋友离开了我，真的走了",
      start: 9.42,
      end: 14.799,
      wordCount: 9,
      words: [
        { text: "My", start: 9.42, end: 10.0 },
        { text: "friend", start: 10.0, end: 10.8 },
        { text: "has", start: 10.8, end: 11.2 },
        { text: "quit", start: 11.2, end: 11.8 },
        { text: "me,", start: 11.8, end: 12.3 },
        { text: "he's", start: 12.3, end: 12.8 },
        { text: "gone", start: 12.8, end: 13.5 },
        { text: "for", start: 13.5, end: 14.0 },
        { text: "sure", start: 14.0, end: 14.799 }
      ]
    },
    {
      lineIndex: 2,
      originalText: "He broke my heart, for I loved him true",
      translatedText: "他伤了我的心，因为我真心爱他",
      start: 16.299,
      end: 21.959,
      wordCount: 9,
      words: [
        { text: "He", start: 16.299, end: 16.8 },
        { text: "broke", start: 16.8, end: 17.5 },
        { text: "my", start: 17.5, end: 17.8 },
        { text: "heart,", start: 17.8, end: 18.5 },
        { text: "for", start: 18.5, end: 19.0 },
        { text: "I", start: 19.0, end: 19.3 },
        { text: "loved", start: 19.3, end: 20.0 },
        { text: "him", start: 20.0, end: 20.5 },
        { text: "true", start: 20.5, end: 21.959 }
      ]
    },
    {
      lineIndex: 3,
      originalText: "So now I'm worried, lonesome, and blue",
      translatedText: "现在我忧心忡忡，孤单又忧郁",
      start: 23.239,
      end: 29.539,
      wordCount: 7,
      words: [
        { text: "So", start: 23.239, end: 23.8 },
        { text: "now", start: 23.8, end: 24.5 },
        { text: "I'm", start: 24.5, end: 25.0 },
        { text: "worried,", start: 25.0, end: 26.0 },
        { text: "lonesome,", start: 26.0, end: 27.5 },
        { text: "and", start: 27.5, end: 28.0 },
        { text: "blue", start: 28.0, end: 29.539 }
      ]
    }
  ]
};

// Practice Mode: Audio-only recording with instrumental backing track
export const PracticeMode: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/clips/down-home-blues-verse-instrumental.mp3", // Instrumental track
    recordingMode: 'cover',
    videoEnabled: false, // No camera for practice
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete'),
  },
};

// Perform Mode: Video + audio recording with instrumental backing track
export const PerformMode: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/clips/down-home-blues-verse-instrumental.mp3", // Instrumental track
    recordingMode: 'cover',
    videoEnabled: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete'),
  },
};

// Lip Sync Mode: Video-only recording with original vocals (no mic)
export const LipSyncMode: Story = {
  args: {
    segment: sampleSegment,
    audioUrl: "/clips/down-home-blues-verse.mp3", // Original vocals
    recordingMode: 'lipsync',
    videoEnabled: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete'),
  },
};

// Recording state example (perform mode)
export const Recording: Story = {
  args: {
    isRecording: true,
    segment: sampleSegment,
    audioUrl: "/clips/down-home-blues-verse-instrumental.mp3",
    recordingMode: 'cover',
    videoEnabled: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete'),
  },
};

// Long segment example (perform mode)
export const WithLongSegment: Story = {
  args: {
    segment: longSegment,
    audioUrl: "/clips/down-home-blues-verse-instrumental.mp3",
    recordingMode: 'cover',
    videoEnabled: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onBack: () => console.log('Back clicked'),
    onRecordingComplete: () => console.log('Recording complete'),
  },
};