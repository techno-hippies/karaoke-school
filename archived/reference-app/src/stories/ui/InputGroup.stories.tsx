import type { Meta, StoryObj } from '@storybook/react'
import { MagnifyingGlass, Check, Copy, Info } from '@phosphor-icons/react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'

const meta: Meta<typeof InputGroup> = {
  title: 'UI/InputGroup',
  component: InputGroup,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic input with search icon addon
 */
export const WithIcon: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon>
          <MagnifyingGlass />
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/**
 * Input with text prefix (URL pattern)
 */
export const WithPrefix: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
    </div>
  ),
}

/**
 * Input with copy button
 */
export const WithButton: Story = {
  render: () => {
    const handleCopy = () => {
      console.log('Copied!')
    }

    return (
      <div className="w-80">
        <InputGroup>
          <InputGroupInput placeholder="https://x.com/shadcn" defaultValue="https://x.com/shadcn" readOnly />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" onClick={handleCopy}>
              <Copy />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    )
  },
}

/**
 * Input with multiple addons
 */
export const WithMultipleAddons: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary" size="icon-xs">
            <Info />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/**
 * Input with verification badge
 */
export const WithBadge: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput placeholder="@username" defaultValue="@shadcn" />
        <InputGroupAddon align="inline-end">
          <div className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full">
            <Check className="size-3" />
          </div>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/**
 * Input with search button
 */
export const WithSearchButton: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput placeholder="Search songs..." />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary">Search</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/**
 * Disabled input group
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup data-disabled>
        <InputGroupInput placeholder="Disabled input" disabled />
        <InputGroupAddon align="inline-end">
          <InputGroupText>Disabled</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/**
 * Social media URL input (real-world example)
 */
export const SocialURL: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <div>
        <label className="block text-base text-neutral-400 mb-2">Twitter</label>
        <InputGroup>
          <InputGroupInput type="url" placeholder="https://twitter.com/username" />
        </InputGroup>
      </div>
    </div>
  ),
}
