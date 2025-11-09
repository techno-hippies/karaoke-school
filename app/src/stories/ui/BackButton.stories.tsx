import type { Meta, StoryObj } from '@storybook/react-vite'
import { BackButton } from '@/components/ui/back-button'

const meta: Meta<typeof BackButton> = {
  title: 'UI/BackButton',
  component: BackButton,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default back button - used in headers with solid backgrounds
 */
export const Default: Story = {
  args: {
    onClick: () => console.log('Back clicked'),
    variant: 'default'
  }
}

/**
 * Floating variant - used over content like album art
 */
export const Floating: Story = {
  render: () => (
    <div className="relative w-96 h-64 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4">
        <BackButton onClick={() => console.log('Back clicked')} variant="floating" />
      </div>
      <div className="absolute bottom-4 left-4 text-white">
        <h2 className="text-2xl font-bold">Album Title</h2>
        <p className="text-white/80">Artist Name</p>
      </div>
    </div>
  )
}

/**
 * Back button in a header context with solid background
 */
export const InHeader: Story = {
  render: () => (
    <div className="w-96 border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 bg-background border-b border-border">
        <BackButton onClick={() => console.log('Back clicked')} variant="default" />
        <h1 className="text-foreground text-base font-semibold">Page Title</h1>
        <div className="w-12" />
      </div>
      <div className="p-4">
        <p className="text-muted-foreground">Page content goes here...</p>
      </div>
    </div>
  )
}

/**
 * Multiple back buttons showing consistent styling
 */
export const Multiple: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
        <BackButton onClick={() => console.log('Back 1')} />
        <span className="text-foreground">Edit Profile</span>
      </div>
      <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
        <BackButton onClick={() => console.log('Back 2')} />
        <span className="text-foreground">Artist Page</span>
      </div>
      <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
        <BackButton onClick={() => console.log('Back 3')} />
        <span className="text-foreground">Song Detail</span>
      </div>
    </div>
  )
}

/**
 * Back button with custom className
 */
export const CustomStyling: Story = {
  args: {
    onClick: () => console.log('Back clicked'),
    className: 'opacity-50'
  }
}
