import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item'

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default spinner
 */
export const Default: Story = {
  render: () => <Spinner />
}

/**
 * Different sizes
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  )
}

/**
 * Different colors
 */
export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-6 text-primary" />
      <Spinner className="size-6 text-green-500" />
      <Spinner className="size-6 text-blue-500" />
      <Spinner className="size-6 text-yellow-500" />
      <Spinner className="size-6 text-purple-500" />
    </div>
  )
}

/**
 * In buttons - spinner shows alongside text
 */
export const InButtons: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Button disabled>
        <Spinner />
        Loading...
      </Button>
      <Button variant="outline" disabled>
        <Spinner />
        Please wait
      </Button>
      <Button variant="secondary" disabled>
        <Spinner />
        Processing
      </Button>
    </div>
  )
}

/**
 * In Item component
 */
export const InItem: Story = {
  render: () => (
    <div className="w-80">
      <Item variant="default" className="gap-3 p-2">
        <ItemMedia variant="icon" className="self-center">
          <Spinner className="size-5" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Processing payment...</ItemTitle>
        </ItemContent>
        <ItemContent className="flex-none justify-end">
          <span className="text-sm tabular-nums text-muted-foreground">$100.00</span>
        </ItemContent>
      </Item>
    </div>
  )
}
