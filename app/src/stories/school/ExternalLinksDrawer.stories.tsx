import type { Meta, StoryObj } from '@storybook/react'
import { ExternalLinksDrawer } from '@/components/school/ExternalLinksDrawer'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'School/ExternalLinksDrawer',
  component: ExternalLinksDrawer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExternalLinksDrawer>

export default meta
type Story = StoryObj<typeof meta>

const mockSongLinks = [
  { label: 'Spotify', url: 'https://open.spotify.com/track/123' },
  { label: 'Apple Music', url: 'https://music.apple.com/song/123' },
  { label: 'YouTube Music', url: 'https://music.youtube.com/watch?v=123' },
]

const mockLyricsLinks = [
  { label: 'Genius', url: 'https://genius.com/song-123' },
  { label: 'AZLyrics', url: 'https://azlyrics.com/song-123' },
]

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>External Links</Button>
        <ExternalLinksDrawer
          open={open}
          onOpenChange={setOpen}
          songLinks={mockSongLinks}
          lyricsLinks={mockLyricsLinks}
        />
      </div>
    )
  },
}

export const SongLinksOnly: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>Song Links</Button>
        <ExternalLinksDrawer
          open={open}
          onOpenChange={setOpen}
          songLinks={mockSongLinks}
          lyricsLinks={[]}
        />
      </div>
    )
  },
}

export const LyricsLinksOnly: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>Lyrics Links</Button>
        <ExternalLinksDrawer
          open={open}
          onOpenChange={setOpen}
          songLinks={[]}
          lyricsLinks={mockLyricsLinks}
        />
      </div>
    )
  },
}

export const Empty: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>No Links</Button>
        <ExternalLinksDrawer
          open={open}
          onOpenChange={setOpen}
          songLinks={[]}
          lyricsLinks={[]}
        />
      </div>
    )
  },
}
