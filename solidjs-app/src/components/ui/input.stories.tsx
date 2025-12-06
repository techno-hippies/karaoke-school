import type { Meta, StoryObj } from 'storybook-solidjs'
import { Input, Textarea } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'chat'],
    },
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
    variant: 'default',
  },
}

export const Chat: Story = {
  args: {
    placeholder: 'Type a message...',
    variant: 'chat',
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

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
}

export const Large: Story = {
  args: {
    placeholder: 'Large input (auth style)',
    class: 'h-14 text-lg px-4',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div class="flex flex-col gap-4 max-w-sm">
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Default (forms)</label>
        <Input placeholder="Enter username" variant="default" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Chat (messaging)</label>
        <Input placeholder="Type a message..." variant="chat" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Large (auth dialogs)</label>
        <Input placeholder="Username" class="h-14 text-lg px-4" />
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
const textareaMeta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'chat'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export const TextareaDefault: StoryObj<typeof Textarea> = {
  render: () => (
    <div class="max-w-sm">
      <Textarea placeholder="Enter your message..." rows={3} variant="default" />
    </div>
  ),
}

export const TextareaChat: StoryObj<typeof Textarea> = {
  render: () => (
    <div class="max-w-sm">
      <Textarea placeholder="Type a message..." rows={1} variant="chat" />
    </div>
  ),
}

export const TextareaAllVariants: StoryObj<typeof Textarea> = {
  render: () => (
    <div class="flex flex-col gap-4 max-w-sm">
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Default (forms)</label>
        <Textarea placeholder="Enter description..." rows={3} variant="default" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-muted-foreground">Chat (messaging)</label>
        <Textarea placeholder="Type a message..." rows={1} variant="chat" />
      </div>
    </div>
  ),
}
