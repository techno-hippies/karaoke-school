import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect } from 'react'
import { KaraokeOverlay } from '@/components/feed/KaraokeOverlay'
import type { KaraokeLine } from '@/components/feed/types'

const meta = {
  title: 'Feed/KaraokeOverlay',
  component: KaraokeOverlay,
  decorators: [
    (Story) => (
      <div className="relative w-full h-screen bg-black">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof KaraokeOverlay>

export default meta
type Story = StoryObj<typeof meta>

// Sample karaoke data
const sampleLines: KaraokeLine[] = [
  {
    text: "I can't stop the feeling",
    translation: "我无法停止这种感觉",
    start: 0,
    end: 3,
    words: [
      { text: "I", start: 0, end: 0.5 },
      { text: "can't", start: 0.5, end: 1.0 },
      { text: "stop", start: 1.0, end: 1.5 },
      { text: "the", start: 1.5, end: 2.0 },
      { text: "feeling", start: 2.0, end: 3.0 },
    ]
  },
  {
    text: "Got this feeling in my body",
    translation: "身体里有这种感觉",
    start: 3,
    end: 6,
    words: [
      { text: "Got", start: 3.0, end: 3.3 },
      { text: "this", start: 3.3, end: 3.6 },
      { text: "feeling", start: 3.6, end: 4.2 },
      { text: "in", start: 4.2, end: 4.5 },
      { text: "my", start: 4.5, end: 4.8 },
      { text: "body", start: 4.8, end: 6.0 },
    ]
  },
  {
    text: "Ooh I can't fight the feeling",
    translation: "哦，我无法抗拒这种感觉",
    start: 6,
    end: 9,
    words: [
      { text: "Ooh", start: 6.0, end: 6.5 },
      { text: "I", start: 6.5, end: 6.7 },
      { text: "can't", start: 6.7, end: 7.2 },
      { text: "fight", start: 7.2, end: 7.7 },
      { text: "the", start: 7.7, end: 8.0 },
      { text: "feeling", start: 8.0, end: 9.0 },
    ]
  },
  {
    text: "Anymore so I'll just let it flow",
    translation: "所以我就让它流淌",
    start: 9,
    end: 12,
    words: [
      { text: "Anymore", start: 9.0, end: 9.5 },
      { text: "so", start: 9.5, end: 9.8 },
      { text: "I'll", start: 9.8, end: 10.0 },
      { text: "just", start: 10.0, end: 10.3 },
      { text: "let", start: 10.3, end: 10.6 },
      { text: "it", start: 10.6, end: 10.8 },
      { text: "flow", start: 10.8, end: 12.0 },
    ]
  },
]

// Interactive wrapper - auto-plays through lyrics
function InteractiveKaraoke({
  lines,
  showNextLine = false
}: {
  lines: KaraokeLine[]
  showNextLine?: boolean
}) {
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((t) => {
        const maxTime = lines[lines.length - 1]?.end || 12
        return t >= maxTime ? 0 : t + 0.1
      })
    }, 100)

    return () => clearInterval(interval)
  }, [lines])

  return (
    <div className="relative w-full h-full">
      {/* Background video placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-teal-900" />

      {/* Karaoke Overlay */}
      <KaraokeOverlay
        lines={lines}
        currentTime={currentTime}
        showNextLine={showNextLine}
      />
    </div>
  )
}

/**
 * Default karaoke overlay
 * Shows lyrics with word-level highlighting and translation
 */
export const Default: Story = {
  render: () => <InteractiveKaraoke lines={sampleLines} />,
}

/**
 * With next line preview
 * Shows next line below current (for karaoke recording mode)
 */
export const WithNextLine: Story = {
  render: () => <InteractiveKaraoke lines={sampleLines} showNextLine={true} />,
}

/**
 * No translation
 * Shows only English lyrics without translation
 */
export const NoTranslation: Story = {
  render: () => {
    const linesNoTranslation = sampleLines.map(line => ({
      ...line,
      translation: undefined
    }))
    return <InteractiveKaraoke lines={linesNoTranslation} />
  },
}

/**
 * No word timing
 * Shows full line highlighting (fallback when word-level timing unavailable)
 */
export const NoWordTiming: Story = {
  render: () => {
    const linesNoWords = sampleLines.map(line => ({
      ...line,
      words: undefined
    }))
    return <InteractiveKaraoke lines={linesNoWords} />
  },
}

/**
 * Long line
 * Tests text wrapping for very long lyrics
 */
export const LongLine: Story = {
  render: () => {
    const longLines: KaraokeLine[] = [
      {
        text: "This is a very long line that should wrap gracefully and demonstrate how the overlay handles extended lyrics text without breaking the layout",
        translation: "这是一行很长的歌词，应该优雅地换行，展示覆盖层如何处理扩展歌词文本而不破坏布局",
        start: 0,
        end: 5,
      }
    ]
    return <InteractiveKaraoke lines={longLines} />
  },
}

/**
 * Static display at specific time
 * Shows overlay frozen at 1.5 seconds - "can't" should be highlighted
 */
export const StaticAtTime: Story = {
  render: () => (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-red-900 to-pink-900" />
      <KaraokeOverlay lines={sampleLines} currentTime={1.5} />
    </div>
  ),
}

/**
 * No active line
 * Shows empty state when currentTime doesn't match any line
 * (time: 99s is past all lines, so nothing displays)
 */
export const NoActiveLine: Story = {
  render: () => (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900" />
      <KaraokeOverlay lines={sampleLines} currentTime={99} />
    </div>
  ),
}

/**
 * Mobile layout
 * Shows overlay in 9:16 mobile aspect ratio
 */
export const MobileLayout: Story = {
  render: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="w-full md:w-[50.625vh] h-full md:h-[90vh] max-w-[450px] max-h-[800px] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900" />
        <InteractiveKaraoke lines={sampleLines} />
      </div>
    </div>
  ),
}
