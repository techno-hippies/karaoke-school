import type { Meta, StoryObj } from '@storybook/react-vite'
import { SealCheck, CaretRight, ShieldWarning, Plus, Info } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  ItemGroup,
  ItemSeparator,
} from '@/components/ui/item'

const meta: Meta<typeof Item> = {
  title: 'UI/Item',
  component: Item,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic item with title and description
 */
export const Default: Story = {
  render: () => (
    <div className="w-96">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Basic Item</ItemTitle>
          <ItemDescription>
            A simple item with title and description.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
}

/**
 * Different variants: default, outline, muted
 */
export const Variants: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Item>
        <ItemContent>
          <ItemTitle>Default Variant</ItemTitle>
          <ItemDescription>
            Standard styling with subtle background and borders.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Outline Variant</ItemTitle>
          <ItemDescription>
            Outlined style with clear borders and transparent background.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Muted Variant</ItemTitle>
          <ItemDescription>
            Subdued appearance with muted colors for secondary content.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
}

/**
 * Different sizes: default and sm
 */
export const Sizes: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Default Size</ItemTitle>
          <ItemDescription>
            Standard padding and spacing for most use cases.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="sm" asChild>
        <button>
          <ItemMedia>
            <SealCheck className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Small Size</ItemTitle>
          </ItemContent>
          <ItemActions>
            <CaretRight className="size-4" />
          </ItemActions>
        </button>
      </Item>
    </div>
  ),
}

/**
 * Item with icon media
 */
export const WithIcon: Story = {
  render: () => (
    <div className="w-96">
      <Item variant="outline">
        <ItemMedia variant="icon">
          <ShieldWarning />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Security Alert</ItemTitle>
          <ItemDescription>
            New login detected from unknown device.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Review
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
}

/**
 * Item with image media
 */
export const WithImage: Story = {
  render: () => (
    <div className="w-96">
      <Item variant="outline" asChild>
        <button>
          <ItemMedia variant="image">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=felix"
              alt="Avatar"
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Midnight City Lights</ItemTitle>
            <ItemDescription>Neon Dreams - Electric Nights</ItemDescription>
          </ItemContent>
          <ItemContent className="flex-none text-center">
            <ItemDescription>3:45</ItemDescription>
          </ItemContent>
        </button>
      </Item>
    </div>
  ),
}

/**
 * Item rendered as a link
 */
export const AsLink: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Item asChild>
        <a href="#">
          <ItemContent>
            <ItemTitle>Visit our documentation</ItemTitle>
            <ItemDescription>
              Learn how to get started with our components.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <CaretRight className="size-4" />
          </ItemActions>
        </a>
      </Item>
      <Item variant="outline" asChild>
        <a href="#" target="_blank" rel="noopener noreferrer">
          <ItemContent>
            <ItemTitle>External resource</ItemTitle>
            <ItemDescription>
              Opens in a new tab with security attributes.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <CaretRight className="size-4" />
          </ItemActions>
        </a>
      </Item>
    </div>
  ),
}

/**
 * Multiple items in a group with separators
 */
export const Group: Story = {
  render: () => (
    <div className="w-96">
      <ItemGroup>
        <Item>
          <ItemMedia variant="icon">
            <SealCheck />
          </ItemMedia>
          <ItemContent className="gap-1">
            <ItemTitle>Profile Verified</ItemTitle>
            <ItemDescription>Your account has been verified.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Plus />
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <ShieldWarning />
          </ItemMedia>
          <ItemContent className="gap-1">
            <ItemTitle>Security Alert</ItemTitle>
            <ItemDescription>New login from unknown device.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Plus />
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <Info />
          </ItemMedia>
          <ItemContent className="gap-1">
            <ItemTitle>System Update</ItemTitle>
            <ItemDescription>A new update is available.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Plus />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  ),
}
