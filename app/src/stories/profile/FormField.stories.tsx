import type { Meta, StoryObj } from '@storybook/react-vite'
import { FormField } from '@/components/profile/FormField'
import { useState } from 'react'

const meta = {
  title: 'Profile/FormField',
  component: FormField,
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
} satisfies Meta<typeof FormField>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Text input - single line
 */
export const TextInput: Story = {
  args: {
    label: 'Name',
    value: 'Jane Doe',
    placeholder: 'Enter your name',
    onChange: (value) => console.log('Changed:', value),
  },
}

/**
 * Empty text input
 */
export const Empty: Story = {
  args: {
    label: 'Name',
    value: '',
    placeholder: 'Enter your name',
    onChange: (value) => console.log('Changed:', value),
  },
}

/**
 * Textarea - multiline with character counter
 */
export const Textarea: Story = {
  args: {
    label: 'Bio',
    value: 'Photographer based in NYC. Coffee addict.',
    placeholder: 'Tell us about yourself',
    multiline: true,
    rows: 3,
    maxLength: 80,
    showCharCount: true,
    onChange: (value) => console.log('Changed:', value),
  },
}

/**
 * Textarea near limit
 */
export const TextareaNearLimit: Story = {
  args: {
    label: 'Bio',
    value: 'Photographer based in NYC. Coffee addict. Love capturing street life and architec',
    placeholder: 'Tell us about yourself',
    multiline: true,
    rows: 3,
    maxLength: 80,
    showCharCount: true,
    onChange: (value) => console.log('Changed:', value),
  },
}

/**
 * Read-only field (tappable)
 */
export const ReadOnly: Story = {
  args: {
    label: 'Username',
    value: '@janedoe.lens',
    readOnly: true,
    onTap: () => console.log('Tapped username field'),
  },
}

/**
 * Disabled field
 */
export const Disabled: Story = {
  args: {
    label: 'Email',
    value: 'jane@example.com',
    disabled: true,
  },
}

/**
 * Interactive example
 */
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('Photographer based in NYC.')
    return (
      <FormField
        label="Bio"
        value={value}
        onChange={setValue}
        placeholder="Tell us about yourself"
        multiline
        rows={3}
        maxLength={80}
        showCharCount
      />
    )
  },
}
