import type { Meta, StoryObj } from '@storybook/react-vite'
import { PerformanceGradePage } from '@/components/post/PerformanceGradePage'

const meta = {
  title: 'Post/PerformanceGradePage',
  component: PerformanceGradePage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PerformanceGradePage>

export default meta
type Story = StoryObj<typeof meta>

const sampleKaraokeLines = [
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
  }
]

/**
 * Perfect - no feedback needed
 */
export const Perfect: Story = {
  args: {
    grade: 'A+',
    topGrade: 'A+',
    songTitle: 'Perfect',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://picsum.photos/seed/song1/400/400',
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    karaokeLines: sampleKaraokeLines,
    onBack: () => console.log('Back clicked'),
    onNext: () => console.log('Next clicked'),
    onPost: () => console.log('Post clicked'),
  },
}

/**
 * Excellent - no feedback needed
 */
export const Excellent: Story = {
  args: {
    grade: 'A',
    topGrade: 'A+',
    songTitle: 'Shape of You',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://picsum.photos/seed/song2/400/400',
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    karaokeLines: sampleKaraokeLines,
    onBack: () => console.log('Back clicked'),
    onNext: () => console.log('Next clicked'),
    onPost: () => console.log('Post clicked'),
  },
}

/**
 * Timing/Pacing Issue
 */
export const PacingIssue: Story = {
  args: {
    grade: 'B+',
    topGrade: 'A',
    songTitle: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://picsum.photos/seed/song3/400/400',
    hasVideo: false,
    problematicLineFeedback: "Watch your pacing:",
    problematicLine: '"So the bar is where I go"',
    onBack: () => console.log('Back clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
}

/**
 * Pronunciation/Word Error
 */
export const PronunciationIssue: Story = {
  args: {
    grade: 'B',
    topGrade: 'A-',
    songTitle: 'Someone Like You',
    artist: 'Adele',
    artworkUrl: 'https://picsum.photos/seed/song4/400/400',
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    karaokeLines: sampleKaraokeLines,
    problematicLineFeedback: "Practice this pronunciation:",
    problematicLine: '"The club isn\'t the best place to find a lover"',
    onBack: () => console.log('Back clicked'),
    onNext: () => console.log('Next clicked'),
    onPost: () => console.log('Post clicked'),
  },
}

/**
 * Missing Section
 */
export const MissedSection: Story = {
  args: {
    grade: 'C+',
    topGrade: 'B',
    songTitle: 'Heat Waves',
    artist: 'Glass Animals',
    artworkUrl: 'https://picsum.photos/seed/song5/400/400',
    hasVideo: false,
    problematicLineFeedback: "You missed this part:",
    problematicLine: '"So the bar is where I go"',
    onBack: () => console.log('Back clicked'),
    onComplete: () => console.log('Complete clicked'),
  },
}

/**
 * Unclear issue - use pronunciation as fallback
 */
export const UnclearIssue: Story = {
  args: {
    grade: 'C',
    topGrade: 'B+',
    songTitle: 'Levitating',
    artist: 'Dua Lipa',
    artworkUrl: 'https://picsum.photos/seed/song6/400/400',
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    karaokeLines: sampleKaraokeLines,
    problematicLineFeedback: "Practice this pronunciation:",
    problematicLine: '"So the bar is where I go"',
    onBack: () => console.log('Back clicked'),
    onNext: () => console.log('Next clicked'),
    onPost: () => console.log('Post clicked'),
  },
}
