import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ExternalLinksSheet } from '@/components/school/ExternalLinksSheet'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Class/ExternalLinksSheet',
  component: ExternalLinksSheet,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExternalLinksSheet>

export default meta
type Story = StoryObj<typeof meta>

// Wrapper component to handle state
function SheetWrapper(args: any) {
  const [open, setOpen] = useState(false)

  return (
    <div className="h-screen flex items-center justify-center">
      <Button onClick={() => setOpen(true)}>Open External Links</Button>
      <ExternalLinksSheet {...args} open={open} onOpenChange={setOpen} />
    </div>
  )
}

export const Default: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    songLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/beyonce/drunk-in-love' },
      { label: 'Maid.zone', url: 'https://maid.zone/beyonce/drunk-in-love' },
    ],
    lyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/Beyonce-drunk-in-love-lyrics' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/Beyonce-drunk-in-love-lyrics?id=299177' },
      { label: 'Dumb', url: 'https://dm.vern.cc/Beyonce-drunk-in-love-lyrics' },
    ],
  },
}

export const SongOnly: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    songLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/beyonce/formation' },
      { label: 'Maid.zone', url: 'https://maid.zone/beyonce/formation' },
    ],
    lyricsLinks: [],
  },
}

export const LyricsOnly: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    songLinks: [],
    lyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/Ethel-waters-down-home-blues-lyrics' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/Ethel-waters-down-home-blues-lyrics?id=123456' },
      { label: 'Dumb', url: 'https://dm.vern.cc/Ethel-waters-down-home-blues-lyrics' },
    ],
  },
}

export const ManyLinks: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    songLinks: [
      { label: 'SoundCloud', url: 'https://soundcloud.com/beyonce/drunk-in-love' },
      { label: 'Maid.zone', url: 'https://maid.zone/beyonce/drunk-in-love' },
    ],
    lyricsLinks: [
      { label: 'Genius', url: 'https://genius.com/Beyonce-drunk-in-love-lyrics' },
      { label: 'Intellectual', url: 'https://intellectual.insprill.net/Beyonce-drunk-in-love-lyrics?id=299177' },
      { label: 'Dumb', url: 'https://dm.vern.cc/Beyonce-drunk-in-love-lyrics' },
    ],
  },
}
