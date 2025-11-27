import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@/components/ui/input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search', 'tel', 'url', 'number']
    },
    disabled: {
      control: 'boolean'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter text...'
  }
}

export const WithValue: Story = {
  args: {
    value: 'Hello World',
    placeholder: 'Enter text...'
  }
}

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email...'
  }
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter your password...'
  }
}

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search songs...'
  }
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true
  }
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-80">
      <label htmlFor="username" className="text-sm font-medium text-foreground">
        Username
      </label>
      <Input id="username" placeholder="Enter your username" />
    </div>
  )
}

export const WithError: Story = {
  render: () => (
    <div className="space-y-2 w-80">
      <label htmlFor="email" className="text-sm font-medium text-foreground">
        Email
      </label>
      <Input
        id="email"
        type="email"
        placeholder="Enter your email"
        className="border-destructive"
      />
      <p className="text-sm text-destructive">Please enter a valid email address</p>
    </div>
  )
}
