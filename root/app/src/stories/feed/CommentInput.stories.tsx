import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommentInput } from '@/components/feed/CommentInput'

const meta = {
  title: 'Feed/CommentInput',
  component: CommentInput,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CommentInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default comment input
 */
export const Default: Story = {
  args: {
    placeholder: 'Add a comment...',
    onSubmit: (comment) => console.log('Submit comment:', comment),
  },
}

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Sign in to comment',
    onSubmit: (comment) => console.log('Submit comment:', comment),
  },
}
