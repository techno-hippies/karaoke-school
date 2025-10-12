import type { Meta, StoryObj } from '@storybook/react-vite'
import { SegmentPickerDrawer, type SongSegment } from '@/components/karaoke/SegmentPickerDrawer'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Karaoke/SegmentPickerDrawer',
  component: SegmentPickerDrawer,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentPickerDrawer>

export default meta
type Story = StoryObj<typeof meta>

// Free audio sample for demo purposes
const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

const sampleSegments: SongSegment[] = [
  { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
  { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
  { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
  { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
]

/**
 * Default segment picker - Mix of owned and unowned
 */
export const Default: Story = {
  args: {
    open: true,
    songTitle: 'Blinding Lights',
    songArtist: 'The Weeknd',
    songArtwork: 'https://placebear.com/400/400',
    segments: sampleSegments,
    onSelectSegment: (segment) => console.log('Selected:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
  },
}

/**
 * Interactive - Click to open
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<SongSegment | null>(null)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Pick a segment
        </Button>
        {selected && (
          <div className="text-center p-4 bg-purple-500/20 rounded-lg">
            <p className="text-lg font-semibold">Selected: {selected.displayName}</p>
          </div>
        )}
        <SegmentPickerDrawer
          open={open}
          onOpenChange={setOpen}
          songTitle="Blinding Lights"
          songArtist="The Weeknd"
          songArtwork="https://placebear.com/400/400"
          segments={sampleSegments}
          onSelectSegment={(segment) => {
            setSelected(segment)
            setOpen(false)
            console.log('Selected segment:', segment)
          }}
        />
      </div>
    )
  },
}

/**
 * Many segments
 */
export const ManySegments: Story = {
  args: {
    open: true,
    songTitle: 'Bohemian Rhapsody',
    songArtist: 'Queen',
    songArtwork: 'https://placebear.com/g/400/400',
    segments: [
      { id: 'intro', displayName: 'Intro', startTime: 0, endTime: 49, duration: 49, audioUrl: DEMO_AUDIO_URL },
      { id: 'verse-1', displayName: 'Verse 1', startTime: 49, endTime: 109, duration: 60, audioUrl: DEMO_AUDIO_URL },
      { id: 'chorus-1', displayName: 'Chorus 1', startTime: 109, endTime: 142, duration: 33, audioUrl: DEMO_AUDIO_URL },
      { id: 'verse-2', displayName: 'Verse 2', startTime: 142, endTime: 169, duration: 27, audioUrl: DEMO_AUDIO_URL },
      { id: 'opera', displayName: 'Opera Section', startTime: 169, endTime: 255, duration: 86, audioUrl: DEMO_AUDIO_URL },
      { id: 'rock', displayName: 'Rock Section', startTime: 255, endTime: 304, duration: 49, audioUrl: DEMO_AUDIO_URL },
      { id: 'outro', displayName: 'Outro', startTime: 304, endTime: 355, duration: 51, audioUrl: DEMO_AUDIO_URL },
    ],
    onSelectSegment: (segment) => console.log('Selected:', segment),
  },
}

/**
 * Short segments (TikTok style)
 */
export const ShortSegments: Story = {
  args: {
    open: true,
    songTitle: 'Heat Waves',
    songArtist: 'Glass Animals',
    songArtwork: 'https://placekitten.com/400/400',
    segments: [
      { id: 'hook', displayName: 'Hook', startTime: 0, endTime: 8, duration: 8, audioUrl: DEMO_AUDIO_URL, isOwned: true },
      { id: 'verse-1', displayName: 'Verse 1', startTime: 8, endTime: 23, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'chorus', displayName: 'Chorus', startTime: 23, endTime: 38, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'drop', displayName: 'Drop', startTime: 53, endTime: 68, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
    ],
    onSelectSegment: (segment) => console.log('Selected:', segment),
  },
}

/**
 * All segments owned
 */
export const AllOwned: Story = {
  args: {
    open: true,
    songTitle: 'Shape of You',
    songArtist: 'Ed Sheeran',
    songArtwork: 'https://placebear.com/g/400/400',
    segments: [
      { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
      { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
      { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
      { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: true },
    ],
    onSelectSegment: (segment) => console.log('Selected:', segment),
  },
}

/**
 * All segments locked - Shows unlock button
 */
export const AllLocked: Story = {
  args: {
    open: true,
    songTitle: 'Anti-Hero',
    songArtist: 'Taylor Swift',
    songArtwork: 'https://placekitten.com/g/400/400',
    segments: [
      { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
    ],
    onSelectSegment: (segment) => console.log('Selected:', segment),
    onUnlockAll: () => console.log('Unlock all segments'),
  },
}

/**
 * Unlock flow - Click unlock to see all segments become owned
 */
export const UnlockFlow: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [segments, setSegments] = useState<SongSegment[]>([
      { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 18, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'chorus-1', displayName: 'Chorus', startTime: 18, endTime: 38, duration: 20, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'verse-2', displayName: 'Verse 2', startTime: 38, endTime: 56, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'bridge', displayName: 'Bridge', startTime: 56, endTime: 71, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
    ])
    const [isUnlocking, setIsUnlocking] = useState(false)

    const handleUnlock = () => {
      setIsUnlocking(true)
      // Simulate unlock delay
      setTimeout(() => {
        setSegments(prev => prev.map(seg => ({ ...seg, isOwned: true })))
        setIsUnlocking(false)
        console.log('All segments unlocked')
      }, 1500)
    }

    const handleReset = () => {
      setOpen(false)
      setSegments([
        { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 18, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
        { id: 'chorus-1', displayName: 'Chorus', startTime: 18, endTime: 38, duration: 20, audioUrl: DEMO_AUDIO_URL, isOwned: false },
        { id: 'verse-2', displayName: 'Verse 2', startTime: 38, endTime: 56, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
        { id: 'bridge', displayName: 'Bridge', startTime: 56, endTime: 71, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      ])
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Open Segment Picker
        </Button>
        {open && segments[0].isOwned && (
          <Button variant="secondary" onClick={handleReset}>
            Reset Demo
          </Button>
        )}
        <SegmentPickerDrawer
          open={open}
          onOpenChange={setOpen}
          songTitle="Breathe Deeper"
          songArtist="Tame Impala"
          songArtwork="https://placebear.com/400/400"
          segments={segments}
          onSelectSegment={(segment) => {
            console.log('Selected segment:', segment)
            setOpen(false)
          }}
          onUnlockAll={handleUnlock}
          isUnlocking={isUnlocking}
        />
      </div>
    )
  },
}

/**
 * Free song - All segments show "Start" button
 */
export const FreeSong: Story = {
  args: {
    open: true,
    songTitle: 'Shape of You',
    songArtist: 'Ed Sheeran',
    songArtwork: 'https://placebear.com/g/400/400',
    segments: [
      { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 15, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'chorus', displayName: 'Chorus', startTime: 15, endTime: 30, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'verse-2', displayName: 'Verse 2', startTime: 45, endTime: 60, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
      { id: 'bridge', displayName: 'Bridge', startTime: 90, endTime: 105, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
    ],
    isFree: true,
    onSelectSegment: (segment) => console.log('Selected:', segment),
  },
}

/**
 * Generating segments - Loading state
 */
export const Generating: Story = {
  args: {
    open: true,
    songTitle: 'Levitating',
    songArtist: 'Dua Lipa',
    songArtwork: 'https://placebear.com/400/400',
    segments: [
      { id: 'placeholder-1', displayName: 'Verse 1', startTime: 0, endTime: 0, duration: 0, isOwned: false },
      { id: 'placeholder-2', displayName: 'Chorus', startTime: 0, endTime: 0, duration: 0, isOwned: false },
      { id: 'placeholder-3', displayName: 'Verse 2', startTime: 0, endTime: 0, duration: 0, isOwned: false },
    ],
    isGenerating: true,
    generatingProgress: 45,
    onSelectSegment: (segment) => console.log('Selected:', segment),
  },
}

/**
 * Generating with auto-progress - Simulates real generation
 */
export const GeneratingAutoProgress: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [segments, setSegments] = useState<SongSegment[]>([
      { id: 'placeholder-1', displayName: 'Verse 1', startTime: 0, endTime: 0, duration: 0, isOwned: false },
      { id: 'placeholder-2', displayName: 'Chorus', startTime: 0, endTime: 0, duration: 0, isOwned: false },
      { id: 'placeholder-3', displayName: 'Verse 2', startTime: 0, endTime: 0, duration: 0, isOwned: false },
    ])

    useEffect(() => {
      if (!isGenerating) return

      // Simulate progress over 10 seconds
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            // Replace placeholders with real segments
            setSegments([
              { id: 'verse-1', displayName: 'Verse 1', startTime: 0, endTime: 18, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
              { id: 'chorus-1', displayName: 'Chorus', startTime: 18, endTime: 38, duration: 20, audioUrl: DEMO_AUDIO_URL, isOwned: false },
              { id: 'verse-2', displayName: 'Verse 2', startTime: 38, endTime: 56, duration: 18, audioUrl: DEMO_AUDIO_URL, isOwned: false },
              { id: 'chorus-2', displayName: 'Chorus 2', startTime: 56, endTime: 76, duration: 20, audioUrl: DEMO_AUDIO_URL, isOwned: false },
              { id: 'bridge', displayName: 'Bridge', startTime: 76, endTime: 91, duration: 15, audioUrl: DEMO_AUDIO_URL, isOwned: false },
            ])
            setIsGenerating(false)
            return 100
          }
          return prev + 1
        })
      }, 100) // 100ms * 100 = 10 seconds

      return () => clearInterval(interval)
    }, [isGenerating])

    const handleGenerate = () => {
      setIsGenerating(true)
      setProgress(0)
      setOpen(true)
    }

    const handleReset = () => {
      setOpen(false)
      setIsGenerating(false)
      setProgress(0)
      setSegments([
        { id: 'placeholder-1', displayName: 'Verse 1', startTime: 0, endTime: 0, duration: 0, isOwned: false },
        { id: 'placeholder-2', displayName: 'Chorus', startTime: 0, endTime: 0, duration: 0, isOwned: false },
        { id: 'placeholder-3', displayName: 'Verse 2', startTime: 0, endTime: 0, duration: 0, isOwned: false },
      ])
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Segments'}
        </Button>
        {open && !isGenerating && (
          <Button variant="secondary" onClick={handleReset}>
            Reset Demo
          </Button>
        )}
        {isGenerating && (
          <div className="text-center p-4 bg-blue-500/20 rounded-lg">
            <p className="text-lg font-semibold">Generating segments: {progress}%</p>
            <p className="text-sm text-muted-foreground">Usually takes ~10 seconds</p>
          </div>
        )}
        <SegmentPickerDrawer
          open={open}
          onOpenChange={setOpen}
          songTitle="Levitating"
          songArtist="Dua Lipa"
          songArtwork="https://placebear.com/400/400"
          segments={segments}
          isGenerating={isGenerating}
          generatingProgress={progress}
          onSelectSegment={(segment) => {
            console.log('Selected segment:', segment)
            setOpen(false)
          }}
        />
      </div>
    )
  },
}
