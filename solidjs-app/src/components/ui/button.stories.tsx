import type { Meta, StoryObj } from 'storybook-solidjs'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient', 'gradient-success', 'gradient-fire', 'gradient-gold', 'recording'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'xl', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
}

export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
}

export const Ghost: Story = {
  args: {
    children: 'Ghost',
    variant: 'ghost',
  },
}

export const Gradient: Story = {
  args: {
    children: 'Gradient',
    variant: 'gradient',
  },
}

export const GradientSuccess: Story = {
  args: {
    children: 'Success',
    variant: 'gradient-success',
  },
}

export const GradientFire: Story = {
  args: {
    children: 'Fire',
    variant: 'gradient-fire',
  },
}

export const GradientGold: Story = {
  args: {
    children: 'Gold',
    variant: 'gradient-gold',
  },
}

export const Recording: Story = {
  args: {
    children: 'Recording...',
    variant: 'recording',
  },
}

export const Small: Story = {
  args: {
    children: 'Small',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    children: 'Large',
    size: 'lg',
  },
}

export const ExtraLarge: Story = {
  args: {
    children: 'Extra Large',
    size: 'xl',
  },
}

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
}

export const AllVariants: Story = {
  render: () => (
    <div class="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button variant="gradient">Gradient</Button>
      <Button variant="gradient-success">Success</Button>
      <Button variant="gradient-fire">Fire</Button>
      <Button variant="gradient-gold">Gold</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
}
