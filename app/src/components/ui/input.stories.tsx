import type { Meta, StoryObj } from 'storybook-solidjs'
import { Input, Textarea } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
}

export const WithValue: Story = {
  args: {
    value: 'Hello world',
  },
}

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'you@example.com',
  },
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
}

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search...',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
}

export const Large: Story = {
  args: {
    placeholder: 'Large input (auth style)',
    class: 'h-14 text-lg',
  },
}

export const AllSizes: Story = {
  render: () => (
    <div class="flex flex-col gap-4 max-w-sm">
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Default</label>
        <Input placeholder="Default size" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Large (auth dialogs)</label>
        <Input placeholder="Large size" class="h-14 text-lg" />
      </div>
    </div>
  ),
}

export const FormExample: Story = {
  render: () => (
    <form class="flex flex-col gap-4 max-w-sm" onSubmit={(e) => e.preventDefault()}>
      <div class="space-y-2">
        <label class="text-sm font-medium">Username</label>
        <Input placeholder="Enter username" minLength={6} />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">Email</label>
        <Input type="email" placeholder="you@example.com" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">Password</label>
        <Input type="password" placeholder="Enter password" />
      </div>
    </form>
  ),
}

// Textarea stories
export const TextareaDefault: StoryObj<typeof Textarea> = {
  render: () => (
    <div class="max-w-sm">
      <Textarea placeholder="Enter your message..." rows={3} />
    </div>
  ),
}

export const TextareaChat: StoryObj<typeof Textarea> = {
  render: () => (
    <div class="max-w-sm">
      <Textarea placeholder="Type a message..." rows={1} />
    </div>
  ),
}
