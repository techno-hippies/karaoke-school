import type { Meta, StoryObj } from 'storybook-solidjs'
import { Progress } from './progress'

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number' },
    max: { control: 'number' },
    class: { control: 'text' },
    indicatorClass: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Progress>

export const Default: Story = {
  args: {
    value: 50,
  },
}

export const Empty: Story = {
  args: {
    value: 0,
  },
}

export const Full: Story = {
  args: {
    value: 100,
  },
}

export const CustomMax: Story = {
  args: {
    value: 3,
    max: 10,
  },
}

export const Gradient: Story = {
  args: {
    value: 75,
    indicatorClass: 'bg-gradient-to-r from-pink-500 to-purple-500',
  },
}

export const Thin: Story = {
  args: {
    value: 60,
    class: 'h-1',
  },
}

export const Thick: Story = {
  args: {
    value: 40,
    class: 'h-4',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div class="w-64 space-y-4">
      <Progress value={25} />
      <Progress value={50} />
      <Progress value={75} indicatorClass="bg-gradient-to-r from-pink-500 to-purple-500" />
      <Progress value={100} />
    </div>
  ),
}
