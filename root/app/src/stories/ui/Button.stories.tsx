import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { MusicNotes, GitBranch, ArrowRight, Download, Plus } from '@phosphor-icons/react';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: <MusicNotes size={20} weight="fill" />,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const LeftAligned: Story = {
  args: {
    variant: 'outline',
    size: 'lg',
    className: 'w-64 justify-start px-4',
    children: 'Left Aligned Button',
  },
};

/**
 * Button with icon - spacing is automatic via gap-2 in button base class.
 * No need to add manual margins (ml-2, mr-2) on icons or text.
 */
export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="outline" size="sm">
        <GitBranch size={16} weight="bold" />
        New Branch
      </Button>
      <Button variant="default">
        <Download size={20} weight="bold" />
        Download
      </Button>
      <Button variant="secondary" size="lg">
        <Plus size={24} weight="bold" />
        Create New
      </Button>
      <Button variant="outline">
        Next
        <ArrowRight size={20} weight="bold" />
      </Button>
    </div>
  ),
};

/**
 * All sizes with icons to show automatic spacing
 */
export const IconSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="outline" size="sm">
        <GitBranch size={16} weight="bold" />
        Small
      </Button>
      <Button variant="outline">
        <GitBranch size={20} weight="bold" />
        Default
      </Button>
      <Button variant="outline" size="lg">
        <GitBranch size={24} weight="bold" />
        Large
      </Button>
    </div>
  ),
};