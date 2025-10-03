import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'oklch(0.145 0 0)' },
        { name: 'light', value: 'oklch(1 0 0)' }
      ]
    }
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-96">
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

export const SongCard: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 bg-muted rounded-md" />
          <div className="flex-1">
            <CardTitle className="text-base">Heat of the Night</CardTitle>
            <CardDescription>Scarlett X</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Badge>Pop</Badge>
          <Badge variant="outline">3:42</Badge>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button className="flex-1">Play</Button>
        <Button variant="outline">Add to Study</Button>
      </CardFooter>
    </Card>
  )
}

export const StudyStatsCard: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Study Progress</CardTitle>
        <CardDescription>Your learning statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">New</span>
          <Badge>12</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Learning</span>
          <Badge variant="secondary">8</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Due</span>
          <Badge variant="outline">5</Badge>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Start Study Session</Button>
      </CardFooter>
    </Card>
  )
}

export const LeaderboardCard: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Top Scorers</CardTitle>
        <CardDescription>Heat of the Night - Verse 1</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥇</span>
          <div className="flex-1">
            <p className="text-sm font-medium">0x1234...5678</p>
            <p className="text-xs text-muted-foreground">Score: 98</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥈</span>
          <div className="flex-1">
            <p className="text-sm font-medium">0xabcd...efgh</p>
            <p className="text-xs text-muted-foreground">Score: 95</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥉</span>
          <div className="flex-1">
            <p className="text-sm font-medium">0x9876...5432</p>
            <p className="text-xs text-muted-foreground">Score: 92</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
