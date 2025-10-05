import type { Meta, StoryObj } from '@storybook/react'
import { CameraRecorder, type Song } from '../../components/record/CameraRecorder'

const meta: Meta<typeof CameraRecorder> = {
  title: 'Record/CameraRecorder',
  component: CameraRecorder,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: '#000000' }
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CameraRecorder>

const sampleSongs: Song[] = [
  {
    id: '1',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    hasInstrumental: true,
    coverUrl: 'https://placebear.com/200/200',
    karaokeLines: [
      {
        text: "The club isn't the best place to find a lover",
        start: 0,
        end: 4,
        words: [
          { text: "The", start: 0, end: 0.3 },
          { text: "club", start: 0.3, end: 0.8 },
          { text: "isn't", start: 0.8, end: 1.2 },
          { text: "the", start: 1.2, end: 1.4 },
          { text: "best", start: 1.4, end: 1.8 },
          { text: "place", start: 1.8, end: 2.3 },
          { text: "to", start: 2.3, end: 2.5 },
          { text: "find", start: 2.5, end: 2.9 },
          { text: "a", start: 2.9, end: 3.0 },
          { text: "lover", start: 3.0, end: 4.0 }
        ]
      },
      {
        text: "So the bar is where I go",
        start: 4.5,
        end: 7.5,
        words: [
          { text: "So", start: 4.5, end: 4.8 },
          { text: "the", start: 4.8, end: 5.0 },
          { text: "bar", start: 5.0, end: 5.5 },
          { text: "is", start: 5.5, end: 5.8 },
          { text: "where", start: 5.8, end: 6.3 },
          { text: "I", start: 6.3, end: 6.5 },
          { text: "go", start: 6.5, end: 7.5 }
        ]
      },
      {
        text: "Me and my friends at the table doing shots",
        start: 8,
        end: 11.5,
        words: [
          { text: "Me", start: 8, end: 8.3 },
          { text: "and", start: 8.3, end: 8.5 },
          { text: "my", start: 8.5, end: 8.7 },
          { text: "friends", start: 8.7, end: 9.2 },
          { text: "at", start: 9.2, end: 9.4 },
          { text: "the", start: 9.4, end: 9.6 },
          { text: "table", start: 9.6, end: 10.0 },
          { text: "doing", start: 10.0, end: 10.5 },
          { text: "shots", start: 10.5, end: 11.5 }
        ]
      },
      {
        text: "Drinking fast and then we talk slow",
        start: 12,
        end: 15,
        words: [
          { text: "Drinking", start: 12, end: 12.6 },
          { text: "fast", start: 12.6, end: 13.0 },
          { text: "and", start: 13.0, end: 13.2 },
          { text: "then", start: 13.2, end: 13.5 },
          { text: "we", start: 13.5, end: 13.7 },
          { text: "talk", start: 13.7, end: 14.2 },
          { text: "slow", start: 14.2, end: 15.0 }
        ]
      }
    ]
  },
  {
    id: '2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    hasInstrumental: false,
    coverUrl: 'https://placebear.com/201/201',
    karaokeLines: [
      {
        text: "I've been tryna call",
        start: 0,
        end: 3,
        words: [
          { text: "I've", start: 0, end: 0.5 },
          { text: "been", start: 0.5, end: 1.0 },
          { text: "tryna", start: 1.0, end: 1.8 },
          { text: "call", start: 1.8, end: 3.0 }
        ]
      },
      {
        text: "I've been on my own for long enough",
        start: 3.5,
        end: 7,
        words: [
          { text: "I've", start: 3.5, end: 3.9 },
          { text: "been", start: 3.9, end: 4.2 },
          { text: "on", start: 4.2, end: 4.5 },
          { text: "my", start: 4.5, end: 4.7 },
          { text: "own", start: 4.7, end: 5.2 },
          { text: "for", start: 5.2, end: 5.5 },
          { text: "long", start: 5.5, end: 6.0 },
          { text: "enough", start: 6.0, end: 7.0 }
        ]
      },
      {
        text: "Maybe you can show me how to love",
        start: 7.5,
        end: 11,
        words: [
          { text: "Maybe", start: 7.5, end: 8.0 },
          { text: "you", start: 8.0, end: 8.2 },
          { text: "can", start: 8.2, end: 8.5 },
          { text: "show", start: 8.5, end: 9.0 },
          { text: "me", start: 9.0, end: 9.3 },
          { text: "how", start: 9.3, end: 9.7 },
          { text: "to", start: 9.7, end: 9.9 },
          { text: "love", start: 9.9, end: 11.0 }
        ]
      }
    ]
  }
]

/**
 * No song selected - shows "Add sound" pill
 */
export const NoSongSelected: Story = {
  args: {
    isRecording: false,
    selectedSong: undefined,
    mode: 'lipsync',
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
}

/**
 * Song selected with instrumental - shows mode tabs
 */
export const WithSongAndInstrumental: Story = {
  args: {
    isRecording: false,
    selectedSong: sampleSongs[0],
    mode: 'lipsync',
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
}

/**
 * Karaoke mode with lyrics visible
 */
export const KaraokeMode: Story = {
  args: {
    isRecording: false,
    selectedSong: sampleSongs[0],
    mode: 'karaoke',
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
}

/**
 * Song without instrumental - no mode tabs shown (lip-sync only)
 */
export const SongWithoutInstrumental: Story = {
  args: {
    isRecording: false,
    selectedSong: sampleSongs[1],
    mode: 'lipsync',
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
}

/**
 * Ready to record state (legacy - no song)
 */
export const Ready: Story = {
  args: {
    isRecording: false,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
}

/**
 * Currently recording in karaoke mode
 */
export const Recording: Story = {
  args: {
    isRecording: true,
    selectedSong: sampleSongs[0],
    mode: 'karaoke',
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
}

/**
 * Interactive countdown demo - enable timer toggle then click record to see countdown
 * The countdown will show 3...2...1 before starting recording
 */
export const CountdownDemo: Story = {
  args: {
    isRecording: false,
    selectedSong: sampleSongs[0],
    mode: 'karaoke',
    onRecord: () => console.log('Record started after countdown'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
    onRemoveSong: () => console.log('Remove song clicked'),
    onModeChange: (mode) => console.log('Mode changed to:', mode),
  },
  parameters: {
    docs: {
      description: {
        story: 'Click the Timer button in the sidebar to enable countdown, then click the record button to see the 3-second countdown animation.'
      }
    }
  }
}
