import type { Meta, StoryObj } from 'storybook-solidjs'
import { LineResultRow, type LineResult } from './LineResultRow'
import { For } from 'solid-js'

const meta: Meta<typeof LineResultRow> = {
  title: 'Karaoke/LineResultRow',
  component: LineResultRow,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div class="p-6 w-full max-w-lg">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof LineResultRow>

const SAMPLE_LYRICS = [
  'The morning sun rises over the hills',
  'Dancing through the night until dawn',
  'Stars are shining bright in the sky',
  'Walking down the empty street',
  'The wind whispers through the trees',
  'Clouds are floating way up high',
  'The river flows to the sea',
]

/** Full session with mixed states */
export const FullSession: Story = {
  render: () => {
    const results: LineResult[] = [
      { status: 'done', score: 93, rating: 'Easy', transcript: SAMPLE_LYRICS[0] },
      { status: 'done', score: 87, rating: 'Easy', transcript: SAMPLE_LYRICS[1] },
      { status: 'done', score: 45, rating: 'Again', transcript: SAMPLE_LYRICS[2] },
      { status: 'done', score: 65, rating: 'Hard', transcript: SAMPLE_LYRICS[3] },
      { status: 'processing' },
      { status: 'pending' },
      { status: 'pending' },
    ]

    return (
      <div class="space-y-2">
        <For each={results}>
          {(result, index) => (
            <LineResultRow
              lineIndex={index()}
              expectedText={SAMPLE_LYRICS[index()]}
              result={result}
            />
          )}
        </For>
      </div>
    )
  },
}
