import type { Meta, StoryObj } from '@storybook/react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const meta: Meta<typeof ScrollArea> = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' },
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const tags = Array.from({ length: 50 }).map(
  (_, i, a) => `v1.2.0-beta.${a.length - i}`
)

/**
 * Basic vertical scrolling area with list of items
 */
export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-72 w-48 rounded-md border border-border">
      <div className="p-4">
        <h4 className="mb-4 text-sm leading-none font-medium">Tags</h4>
        {tags.map((tag) => (
          <div key={tag}>
            <div className="text-sm">{tag}</div>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

/**
 * Horizontal scrolling area with image gallery
 */
export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-96 rounded-md border border-border whitespace-nowrap">
      <div className="flex w-max space-x-4 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="shrink-0">
            <div className="overflow-hidden rounded-md">
              <img
                src={`https://picsum.photos/200/300?random=${i}`}
                alt={`Image ${i + 1}`}
                className="aspect-[2/3] h-48 w-32 object-cover"
              />
            </div>
            <p className="text-muted-foreground pt-2 text-xs text-center">
              Photo {i + 1}
            </p>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

/**
 * Song list example - real-world usage
 */
export const SongList: Story = {
  render: () => (
    <ScrollArea className="h-96 w-80 rounded-md border border-border">
      <div className="p-4 space-y-2">
        <h4 className="mb-4 text-lg font-semibold">Trending Songs</h4>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 hover:bg-secondary/50 rounded-md transition-colors cursor-pointer"
          >
            <div className="size-12 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Song Title {i + 1}</p>
              <p className="text-xs text-muted-foreground truncate">Artist Name</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.floor(Math.random() * 5)}:
              {Math.floor(Math.random() * 60).toString().padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

/**
 * Comment section example - full height container
 */
export const CommentSection: Story = {
  render: () => (
    <div className="h-[600px] w-96 border border-border rounded-md flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">42 Comments</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">user_{i + 1}</span>
                  <span className="text-xs text-muted-foreground">2h ago</span>
                </div>
                <p className="text-sm">
                  This is a comment example. Great video!
                  {i % 3 === 0 && ' This one is a bit longer to show how text wraps in the comment section.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border">
        <input
          type="text"
          placeholder="Add a comment..."
          className="w-full px-3 py-2 bg-secondary rounded-md text-sm"
        />
      </div>
    </div>
  )
}

/**
 * Minimal example - just content overflow
 */
export const Simple: Story = {
  render: () => (
    <ScrollArea className="h-48 w-64 rounded-md border border-border p-4">
      <p className="text-sm">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
        velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
        occaecat cupidatat non proident, sunt in culpa qui officia deserunt
        mollit anim id est laborum.
      </p>
    </ScrollArea>
  )
}
