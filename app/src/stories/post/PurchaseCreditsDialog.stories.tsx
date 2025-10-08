import type { Meta, StoryObj } from '@storybook/react-vite'
import { PurchaseCreditsDialog } from '@/components/post/PurchaseCreditsDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Post/PurchaseCreditsDialog',
  component: PurchaseCreditsDialog,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PurchaseCreditsDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default purchase dialog
 */
export const Default: Story = {
  args: {
    open: true,
    price: '$10',
    creditAmount: 20,
    onPurchase: () => console.log('Purchase clicked'),
  },
}

/**
 * Interactive - Click button to open
 */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [purchased, setPurchased] = useState(false)

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Button onClick={() => setOpen(true)}>
          Open Purchase Dialog
        </Button>
        {purchased && (
          <div className="text-center p-4 bg-green-500/20 rounded-lg">
            <p className="text-lg font-semibold">Credits purchased!</p>
          </div>
        )}
        <PurchaseCreditsDialog
          open={open}
          onOpenChange={setOpen}
          price="$10"
          creditAmount={20}
          onPurchase={() => {
            setPurchased(true)
            setOpen(false)
            console.log('Credits purchased!')
            setTimeout(() => setPurchased(false), 3000)
          }}
        />
      </div>
    )
  },
}
