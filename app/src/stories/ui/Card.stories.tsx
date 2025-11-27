import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge' // TODO: Use in card examples

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
        light: { name: 'light', value: 'oklch(1 0 0)' }
      }
    }
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-96">
        <Story />
      </div>
    )
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Card content goes here.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  )
}
