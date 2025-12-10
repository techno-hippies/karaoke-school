import type { Meta, StoryObj } from 'storybook-solidjs'
import { Avatar } from './avatar'

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
    src: { control: 'text' },
    alt: { control: 'text' },
    fallback: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = {
  args: {
    src: 'https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4',
    alt: 'Taylor Swift',
  },
}

export const WithFallback: Story = {
  args: {
    alt: 'John Doe',
    fallback: 'JD',
  },
}

export const NoImage: Story = {
  args: {},
}

export const Sizes: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <Avatar size="xs" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="XS" />
      <Avatar size="sm" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="SM" />
      <Avatar size="md" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="MD" />
      <Avatar size="lg" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="LG" />
      <Avatar size="xl" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="XL" />
      <Avatar size="2xl" src="https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4" alt="2XL" />
    </div>
  ),
}

export const FallbackSizes: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <Avatar size="xs" fallback="A" />
      <Avatar size="sm" fallback="B" />
      <Avatar size="md" fallback="C" />
      <Avatar size="lg" fallback="D" />
      <Avatar size="xl" fallback="E" />
      <Avatar size="2xl" fallback="F" />
    </div>
  ),
}
