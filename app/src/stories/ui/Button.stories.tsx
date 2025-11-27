import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient', 'gradient-success', 'gradient-fire', 'gradient-gold', 'recording'],
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

/**
 * Button with loading spinner - automatically disabled
 */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default" disabled>
        <Spinner size="sm" />
        Loading
      </Button>
      <Button variant="outline" disabled>
        <Spinner size="sm" />
        Processing
      </Button>
      <Button variant="secondary" size="lg" disabled>
        <Spinner />
        Unlocking
      </Button>
    </div>
  ),
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

/**
 * Gradient buttons - vibrant, eye-catching CTAs with glow on hover
 */
export const Gradients: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <Button variant="gradient">
          <MusicNotes size={20} weight="fill" />
          Start Practice
        </Button>
        <Button variant="gradient-success">
          <MusicNotes size={20} weight="fill" />
          Complete
        </Button>
        <Button variant="gradient-fire">
          <MusicNotes size={20} weight="fill" />
          Hot Streak
        </Button>
        <Button variant="gradient-gold">
          <MusicNotes size={20} weight="fill" />
          Premium
        </Button>
      </div>
      <div className="flex flex-wrap gap-4">
        <Button variant="gradient" size="lg">
          Large Gradient
        </Button>
        <Button variant="gradient-success" size="sm">
          Small Success
        </Button>
      </div>
    </div>
  ),
};

/**
 * Recording state - pulsing glow animation for active recording
 */
export const Recording: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button variant="recording" size="lg" className="w-48">
        Recording...
      </Button>
      <p className="text-sm text-muted-foreground">
        Pulsing glow indicates active recording
      </p>
    </div>
  ),
};

/**
 * All button variants comparison
 */
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
      <Button variant="recording">Recording</Button>
    </div>
  ),
};