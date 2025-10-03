import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '../components/ui/input'

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'HTML input type',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search...',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const WithLabel: Story = {
  decorators: [
    (Story) => (
      <div className="w-80 space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-neutral-200">
          Email
        </label>
        <Story />
      </div>
    ),
  ],
  args: {
    id: 'email',
    type: 'email',
    placeholder: 'hello@example.com',
  },
}

export const Invalid: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email',
    'aria-invalid': true,
  },
  decorators: [
    (Story) => (
      <div className="w-80 space-y-2">
        <label htmlFor="email-invalid" className="text-sm font-medium text-neutral-200">
          Email
        </label>
        <Story />
        <p className="text-sm text-destructive">Please enter a valid email address</p>
      </div>
    ),
  ],
}

export const Large: Story = {
  args: {
    placeholder: 'Large input',
    className: 'h-14 text-base px-4',
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}
