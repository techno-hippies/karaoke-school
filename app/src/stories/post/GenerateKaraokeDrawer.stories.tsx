import type { Meta, StoryObj } from '@storybook/react-vite'
import { GenerateKaraokeDrawer } from '@/components/post/GenerateKaraokeDrawer'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Post/GenerateKaraokeDrawer',
  component: GenerateKaraokeDrawer,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GenerateKaraokeDrawer>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default generate drawer
 */
export const Default: Story = {
  args: {
    open: true,
    onGenerate: () => console.log('Generate clicked'),
  },
}

/**
 * Interactive - Click to open
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [generating, setGenerating] = useState(false)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Open Generate Drawer
        </Button>
        {generating && (
          <div className="text-center p-4 bg-blue-500/20 rounded-lg">
            <p className="text-lg font-semibold">Generating karaoke segments...</p>
          </div>
        )}
        <GenerateKaraokeDrawer
          open={open}
          onOpenChange={setOpen}
          onGenerate={() => {
            setGenerating(true)
            setOpen(false)
            console.log('Generating karaoke...')
            setTimeout(() => setGenerating(false), 3000)
          }}
        />
      </div>
    )
  },
}
