import type { Meta, StoryObj } from '@storybook/react-vite'
import { ContextIndicator } from '@/components/chat/ContextIndicator'

const meta = {
  title: 'Chat/ContextIndicator',
  component: ContextIndicator,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ContextIndicator>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Low usage - under 30%
 */
export const LowUsage: Story = {
  args: {
    tokensUsed: 8500,
    maxTokens: 32000,
  },
}

/**
 * Medium usage - around 50%
 */
export const MediumUsage: Story = {
  args: {
    tokensUsed: 16000,
    maxTokens: 32000,
  },
}

/**
 * Warning level - 70-89%
 */
export const WarningLevel: Story = {
  args: {
    tokensUsed: 24000,
    maxTokens: 32000,
  },
}

/**
 * Critical level - 90%+
 */
export const CriticalLevel: Story = {
  args: {
    tokensUsed: 30500,
    maxTokens: 32000,
  },
}

/**
 * At maximum
 */
export const AtMaximum: Story = {
  args: {
    tokensUsed: 32000,
    maxTokens: 32000,
  },
}

/**
 * Default Chat - 64k context window at 48%
 */
export const DefaultChat64k: Story = {
  args: {
    tokensUsed: 30500,
    maxTokens: 64000,
  },
}

/**
 * All levels comparison
 */
export const AllLevels: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="w-32 text-sm text-muted-foreground">4% (Low)</span>
        <ContextIndicator tokensUsed={1200} maxTokens={32000} />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-32 text-sm text-muted-foreground">26% (Low)</span>
        <ContextIndicator tokensUsed={8500} maxTokens={32000} />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-32 text-sm text-muted-foreground">50% (Medium)</span>
        <ContextIndicator tokensUsed={16000} maxTokens={32000} />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-32 text-sm text-muted-foreground">75% (Warning)</span>
        <ContextIndicator tokensUsed={24000} maxTokens={32000} />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-32 text-sm text-muted-foreground">95% (Critical)</span>
        <ContextIndicator tokensUsed={30500} maxTokens={32000} />
      </div>
      <div className="flex items-center gap-4 mt-8 pt-8 border-t border-border">
        <span className="w-32 text-sm text-muted-foreground">48% (64k)</span>
        <ContextIndicator tokensUsed={30500} maxTokens={64000} />
      </div>
    </div>
  ),
}
