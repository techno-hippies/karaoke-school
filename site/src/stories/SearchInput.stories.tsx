import type { Meta, StoryObj } from '@storybook/react'
import { SearchInput } from '../components/ui/SearchInput'

const meta = {
  title: 'Components/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the input',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state of the search',
    },
    isConnected: {
      control: 'boolean',
      description: 'Whether wallet is connected',
    },
    onSearch: {
      action: 'searched',
      description: 'Called when search is triggered',
    },
    onConnectClick: {
      action: 'connect-clicked',
      description: 'Called when connect wallet is clicked',
    },
  },
} satisfies Meta<typeof SearchInput>

export default meta
type Story = StoryObj<typeof meta>

export const Connected: Story = {
  args: {
    placeholder: 'Search for songs...',
    isLoading: false,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}

export const Disconnected: Story = {
  args: {
    placeholder: 'Search for songs...',
    isLoading: false,
    isConnected: false,
    onConnectClick: () => console.log('Connect wallet clicked'),
    onSearch: (query) => console.log('Searched:', query),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}

export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Search for artists, albums, or songs...',
    isLoading: false,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}

export const Loading: Story = {
  args: {
    placeholder: 'Search for songs...',
    isLoading: true,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}

export const WithContainer: Story = {
  decorators: [
    (Story) => (
      <div className="w-96 p-6 bg-neutral-900 rounded-lg">
        <h3 className="text-white text-lg font-semibold mb-4">Find Your Music</h3>
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: 'Try "Kendrick Lamar" or "Dancing Queen"',
    isLoading: false,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full px-4">
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: 'Search songs...',
    isLoading: false,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
}

export const FullWidth: Story = {
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: 'Search for songs...',
    isLoading: false,
    isConnected: true,
    onSearch: (query) => console.log('Searched:', query),
  },
}
