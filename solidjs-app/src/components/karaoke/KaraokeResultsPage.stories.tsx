import type { Meta, StoryObj } from 'storybook-solidjs'
import { KaraokeResultsPage } from './KaraokeResultsPage'
import type { LineResult } from './LineResultRow'
import { createSignal } from 'solid-js'

const meta: Meta<typeof KaraokeResultsPage> = {
  title: 'Karaoke/KaraokeResultsPage',
  component: KaraokeResultsPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0a0a0a' }],
    },
  },
}

export default meta
type Story = StoryObj<typeof KaraokeResultsPage>

const SAMPLE_LYRICS = [
  'The morning sun rises over the hills',
  'Dancing through the night until dawn',
  'Stars are shining bright in the sky',
  'Walking down the empty street',
  'The wind whispers through the trees',
  'Clouds are floating way up high',
  'The river flows to the sea',
]

/** Interactive demo - auto-starts grading, click Play Again to restart */
export const LiveGradingDemo: Story = {
  render: () => {
    const [lineResults, setLineResults] = createSignal<LineResult[]>(
      SAMPLE_LYRICS.map(() => ({ status: 'pending' as const }))
    )

    let currentIndex = 0
    let interval: number

    const startGrading = () => {
      currentIndex = 0
      setLineResults(SAMPLE_LYRICS.map(() => ({ status: 'pending' as const })))

      setLineResults((prev) => {
        const next = [...prev]
        next[0] = { status: 'processing' }
        return next
      })

      interval = setInterval(() => {
        if (currentIndex >= SAMPLE_LYRICS.length) {
          clearInterval(interval)
          return
        }

        const idx = currentIndex
        const score = 50 + Math.floor(Math.random() * 45)
        setLineResults((prev) => {
          const next = [...prev]
          next[idx] = {
            status: 'done',
            score,
            rating: score >= 90 ? 'Easy' : score >= 75 ? 'Good' : score >= 60 ? 'Hard' : 'Again',
            transcript: SAMPLE_LYRICS[idx],
          }
          if (idx + 1 < SAMPLE_LYRICS.length) {
            next[idx + 1] = { status: 'processing' }
          }
          return next
        })

        currentIndex++
      }, 1200)
    }

    setTimeout(startGrading, 500)

    return (
      <KaraokeResultsPage
        expectedTexts={SAMPLE_LYRICS}
        lineResults={lineResults()}
        onPlayAgain={() => startGrading()}
        onClose={() => console.log('Close clicked')}
      />
    )
  },
}

/** Mid-grading state - slot machine spinning, some lines done */
export const StillProcessing: Story = {
  args: {
    expectedTexts: SAMPLE_LYRICS,
    lineResults: SAMPLE_LYRICS.map((text, i) =>
      i < 4
        ? {
            status: 'done' as const,
            score: 75 + Math.floor(Math.random() * 20),
            rating: 'Good',
            transcript: text,
          }
        : i === 4
          ? { status: 'processing' as const }
          : { status: 'pending' as const }
    ),
  },
}

/** Completed with mixed pass/fail results */
export const MixedResults: Story = {
  args: {
    expectedTexts: SAMPLE_LYRICS,
    lineResults: SAMPLE_LYRICS.map((text, i) => ({
      status: 'done' as const,
      score: i % 3 === 0 ? 50 : 70,
      rating: i % 3 === 0 ? 'Again' : 'Hard',
      transcript: text,
    })),
  },
}

// 30 lines of generic practice phrases for scrolling demo
const LONG_PRACTICE_LINES = [
  'The quick brown fox jumps over the lazy dog',
  'She sells seashells by the seashore',
  'How much wood would a woodchuck chuck',
  'Peter Piper picked a peck of pickled peppers',
  'Red lorry yellow lorry red lorry yellow lorry',
  'Unique New York unique New York you know you need unique New York',
  'The sixth sick sheik sixth sheep is sick',
  'I scream you scream we all scream for ice cream',
  'Betty Botter bought some butter but she said the butter is bitter',
  'Around the rugged rocks the ragged rascal ran',
  'Fresh French fried fish from France',
  'A proper copper coffee pot',
  'Rubber baby buggy bumpers',
  'Six slippery snails slid slowly seaward',
  'The great Greek grape growers grow great Greek grapes',
  'Seventy seven benevolent elephants',
  'Red blood blue blood red blood blue blood',
  'Toy boat toy boat toy boat',
  'Black background brown background',
  'Which witch wished which wicked wish',
  'Nine nice night nurses nursing nicely',
  'Four fine fresh fish for you',
  'Mixed biscuits mixed biscuits mixed biscuits',
  'A noisy noise annoys an oyster',
  'She sees cheese she sees fleas',
  'Freshly fried fresh flesh',
  'Pad kid poured curd pulled cold',
  'Lesser leather never weathered wetter weather better',
  'Imagine an imaginary menagerie manager',
  'Six Czech cricket critics',
]

/** Long list with 30 lines to test scrolling behavior */
export const LongList: Story = {
  args: {
    expectedTexts: LONG_PRACTICE_LINES,
    lineResults: LONG_PRACTICE_LINES.map((text, i) => ({
      status: 'done' as const,
      score: 45 + Math.floor((i * 7) % 50),
      rating: i % 5 === 0 ? 'Easy' : i % 4 === 0 ? 'Good' : i % 3 === 0 ? 'Hard' : 'Again',
      transcript: text,
    })),
  },
}
