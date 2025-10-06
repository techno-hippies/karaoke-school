import type { Meta, StoryObj } from '@storybook/react'
import { ShareDrawer } from '@/components/feed/ShareDrawer'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Feed/ShareDrawer',
  component: ShareDrawer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ShareDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>Share</Button>
        <ShareDrawer
          open={open}
          onOpenChange={setOpen}
          postUrl="https://example.com/video/123"
          postDescription="Check out this amazing karaoke performance!"
          onCopyLink={() => console.log('Link copied!')}
          onDownload={() => console.log('Download started')}
        />
      </div>
    )
  },
}

export const WithCustomDescription: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <div className="flex items-center justify-center h-screen">
        <Button onClick={() => setOpen(true)}>Share Custom</Button>
        <ShareDrawer
          open={open}
          onOpenChange={setOpen}
          postUrl="https://example.com/video/456"
          postDescription="🎤 Just nailed this song on Karaoke School! Join me!"
          onCopyLink={() => console.log('Link copied!')}
          onDownload={() => console.log('Download started')}
        />
      </div>
    )
  },
}
