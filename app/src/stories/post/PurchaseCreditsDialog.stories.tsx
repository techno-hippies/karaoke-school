import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PurchaseCreditsDialog } from '@/components/post/PurchaseCreditsDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import i18n from '@/i18n/config'

const meta = {
  title: 'Post/PurchaseCreditsDialog',
  component: PurchaseCreditsDialog,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs', 'vitest'], // Use 'vitest' tag to enable testing for this story only
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
 * Interactive - Click button to open (manual testing)
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

/**
 * Test: User clicks Buy button
 * Verifies the main CTA works and callback fires
 */
export const ClickBuy: Story = {
  args: {
    open: true,
    price: '$10',
    creditAmount: 20,
    onPurchase: fn(), // Mock function for spying
  },
  play: async ({ args }) => {
    // Radix dialogs are portaled to document.body
    const body = within(document.body)

    const title = await body.findByText('Get Karaoke Credits')
    await expect(title).toBeInTheDocument()

    await expect(body.getByText('$10')).toBeInTheDocument()
    await expect(body.getByText('for 20 credits')).toBeInTheDocument()

    // Find and click the Buy button
    const buyButton = body.getByRole('button', { name: 'Buy' })
    await userEvent.click(buyButton)

    // Verify the callback was called
    await expect(args.onPurchase).toHaveBeenCalledOnce()
  },
}

/**
 * Test: Multi-language rendering
 * Verifies component works in all 3 supported languages
 */
export const AllLanguages: Story = {
  args: {
    open: true,
    price: '$10',
    creditAmount: 20,
    onPurchase: () => console.log('Purchase clicked'),
  },
  play: async () => {
    // Radix dialogs are portaled to document.body
    const body = within(document.body)

    // Test English (default) - wait for dialog to appear
    await i18n.changeLanguage('en')
    const englishTitle = await body.findByText('Get Karaoke Credits')
    await expect(englishTitle).toBeInTheDocument()
    await expect(body.getByText('USDC')).toBeInTheDocument()
    await expect(body.getByText('for 20 credits')).toBeInTheDocument()
    await expect(body.getByRole('button', { name: 'Buy' })).toBeInTheDocument()

    // Test Chinese - wait for text to update
    await i18n.changeLanguage('zh-CN')
    const chineseTitle = await body.findByText('获取卡拉OK积分')
    await expect(chineseTitle).toBeInTheDocument()
    await expect(body.getByText('USDC')).toBeInTheDocument()
    await expect(body.getByText('20 积分')).toBeInTheDocument()
    await expect(body.getByRole('button', { name: '购买' })).toBeInTheDocument()

    // Test Vietnamese - wait for text to update
    await i18n.changeLanguage('vi')
    const vietnameseTitle = await body.findByText('Nhận Tín Dụng Karaoke')
    await expect(vietnameseTitle).toBeInTheDocument()
    await expect(body.getByText('USDC')).toBeInTheDocument()
    await expect(body.getByText('cho 20 tín dụng')).toBeInTheDocument()
    await expect(body.getByRole('button', { name: 'Mua' })).toBeInTheDocument()

    // Reset to English for other tests
    await i18n.changeLanguage('en')
  },
}
