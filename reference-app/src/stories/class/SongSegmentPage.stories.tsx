import type { Meta, StoryObj } from '@storybook/react-vite'
import { SongSegmentPage } from '@/components/class/SongSegmentPage'

const meta = {
  title: 'Class/SongSegmentPage',
  component: SongSegmentPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SongSegmentPage>

export default meta
type Story = StoryObj<typeof meta>

const verse1Lyrics = [
  {
    lineIndex: 0,
    originalText: 'Walking down the street today',
    translations: { cn: '今天走在街上' },
    start: 0,
    end: 2.5,
    words: [
      { text: 'Walking', start: 0, end: 0.5 },
      { text: 'down', start: 0.5, end: 0.8 },
      { text: 'the', start: 0.8, end: 1.0 },
      { text: 'street', start: 1.0, end: 1.5 },
      { text: 'today', start: 1.5, end: 2.5 },
    ],
  },
  {
    lineIndex: 1,
    originalText: 'Feeling good, feeling free',
    translations: { cn: '感觉很好，感觉自由' },
    start: 2.5,
    end: 5.0,
    words: [
      { text: 'Feeling', start: 2.5, end: 3.0 },
      { text: 'good,', start: 3.0, end: 3.5 },
      { text: 'feeling', start: 3.5, end: 4.2 },
      { text: 'free', start: 4.2, end: 5.0 },
    ],
  },
  {
    lineIndex: 2,
    originalText: 'The sun is shining bright',
    translations: { cn: '阳光明媚' },
    start: 5.0,
    end: 7.5,
  },
  {
    lineIndex: 3,
    originalText: 'Everything feels right',
    translations: { cn: '一切都感觉很好' },
    start: 7.5,
    end: 10.0,
  },
]

const chorusLyrics = [
  {
    lineIndex: 0,
    originalText: 'Heat of the night, burning so bright',
    translations: { cn: '夜晚的热度，燃烧得如此明亮' },
    start: 10.0,
    end: 13.0,
  },
  {
    lineIndex: 1,
    originalText: 'Can you feel it, can you see it',
    translations: { cn: '你能感觉到吗，你能看到吗' },
    start: 13.0,
    end: 16.0,
  },
  {
    lineIndex: 2,
    originalText: "We're dancing through the fire",
    translations: { cn: '我们在火中跳舞' },
    start: 16.0,
    end: 19.0,
  },
  {
    lineIndex: 3,
    originalText: 'Taking us higher and higher',
    translations: { cn: '带我们越来越高' },
    start: 19.0,
    end: 22.0,
  },
]

const longLyrics = [
  {
    lineIndex: 0,
    originalText: 'This is the first line of a longer segment',
    translations: { cn: '这是一个较长段落的第一行' },
    start: 0,
    end: 3.0,
  },
  {
    lineIndex: 1,
    originalText: 'With multiple lines of text to demonstrate scrolling',
    translations: { cn: '有多行文本来演示滚动' },
    start: 3.0,
    end: 6.0,
  },
  {
    lineIndex: 2,
    originalText: 'Every line has its own translation',
    translations: { cn: '每一行都有自己的翻译' },
    start: 6.0,
    end: 9.0,
  },
  {
    lineIndex: 3,
    originalText: 'Making it easier to understand the lyrics',
    translations: { cn: '使歌词更容易理解' },
    start: 9.0,
    end: 12.0,
  },
  {
    lineIndex: 4,
    originalText: 'You can study each line carefully',
    translations: { cn: '你可以仔细研究每一行' },
    start: 12.0,
    end: 15.0,
  },
  {
    lineIndex: 5,
    originalText: 'And practice your pronunciation',
    translations: { cn: '并练习你的发音' },
    start: 15.0,
    end: 18.0,
  },
  {
    lineIndex: 6,
    originalText: 'Before moving on to the karaoke mode',
    translations: { cn: '在继续卡拉OK模式之前' },
    start: 18.0,
    end: 21.0,
  },
  {
    lineIndex: 7,
    originalText: 'Where you can sing along with the music',
    translations: { cn: '在那里你可以跟着音乐唱歌' },
    start: 21.0,
    end: 24.0,
  },
  {
    lineIndex: 8,
    originalText: 'Walking down the street in the morning light',
    translations: { cn: '在晨光中走在街上' },
    start: 24.0,
    end: 27.0,
  },
  {
    lineIndex: 9,
    originalText: 'Feeling the rhythm of the city coming alive',
    translations: { cn: '感受城市苏醒的节奏' },
    start: 27.0,
    end: 30.0,
  },
  {
    lineIndex: 10,
    originalText: 'Every moment is a chance to learn something new',
    translations: { cn: '每一刻都是学习新事物的机会' },
    start: 30.0,
    end: 33.0,
  },
  {
    lineIndex: 11,
    originalText: 'Every word brings me closer to you',
    translations: { cn: '每一个词都让我更接近你' },
    start: 33.0,
    end: 36.0,
  },
  {
    lineIndex: 12,
    originalText: 'Through the language we can share our dreams',
    translations: { cn: '通过语言我们可以分享我们的梦想' },
    start: 36.0,
    end: 39.0,
  },
  {
    lineIndex: 13,
    originalText: 'Breaking down barriers, building bridges between',
    translations: { cn: '打破障碍，在之间架起桥梁' },
    start: 39.0,
    end: 42.0,
  },
  {
    lineIndex: 14,
    originalText: 'The world is vast but words connect us all',
    translations: { cn: '世界很大但文字将我们连接' },
    start: 42.0,
    end: 45.0,
  },
  {
    lineIndex: 15,
    originalText: 'From east to west, we rise and never fall',
    translations: { cn: '从东到西，我们崛起永不倒下' },
    start: 45.0,
    end: 48.0,
  },
  {
    lineIndex: 16,
    originalText: 'Singing these lyrics, learning every phrase',
    translations: { cn: '唱着这些歌词，学习每一个短语' },
    start: 48.0,
    end: 51.0,
  },
  {
    lineIndex: 17,
    originalText: 'Finding my voice in these melodic ways',
    translations: { cn: '在这些旋律中找到我的声音' },
    start: 51.0,
    end: 54.0,
  },
  {
    lineIndex: 18,
    originalText: 'The rhythm guides me through each line',
    translations: { cn: '节奏引导我穿过每一行' },
    start: 54.0,
    end: 57.0,
  },
  {
    lineIndex: 19,
    originalText: 'Making this language forever mine',
    translations: { cn: '让这种语言永远属于我' },
    start: 57.0,
    end: 60.0,
  },
]

export const Verse: Story = {
  args: {
    segmentName: 'Verse 1',
    lyrics: longLyrics,
    topScore: 87,
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const Chorus: Story = {
  args: {
    segmentName: 'Chorus',
    lyrics: chorusLyrics,
    topScore: 95,
    newCount: 8,
    learningCount: 3,
    dueCount: 5,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const WithoutTranslations: Story = {
  args: {
    segmentName: 'Verse 1',
    lyrics: verse1Lyrics,
    topScore: 72,
    newCount: 10,
    learningCount: 2,
    dueCount: 15,
    showTranslations: false,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const LongSegment: Story = {
  args: {
    segmentName: 'Bridge',
    lyrics: longLyrics,
    topScore: 88,
    newCount: 6,
    learningCount: 4,
    dueCount: 12,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const StudyLoading: Story = {
  args: {
    segmentName: 'Verse 1',
    lyrics: verse1Lyrics,
    topScore: 82,
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    selectedLanguage: 'cn',
    showTranslations: true,
    isStudyLoading: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

export const KaraokeLoading: Story = {
  args: {
    segmentName: 'Chorus',
    lyrics: chorusLyrics,
    topScore: 93,
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
    selectedLanguage: 'cn',
    showTranslations: true,
    isKaraokeLoading: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Never attempted - Shows placeholder when user hasn't tried karaoke yet
 */
export const NeverAttempted: Story = {
  args: {
    segmentName: 'Verse 2',
    lyrics: verse1Lyrics,
    topScore: undefined,
    newCount: 20,
    learningCount: 8,
    dueCount: 3,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Perfect score - 100%
 */
export const PerfectScore: Story = {
  args: {
    segmentName: 'Chorus',
    lyrics: chorusLyrics,
    topScore: 100,
    newCount: 5,
    learningCount: 2,
    dueCount: 0,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}

/**
 * Empty study stats - All cards mastered
 */
export const EmptyStats: Story = {
  args: {
    segmentName: 'Bridge',
    lyrics: longLyrics,
    topScore: 95,
    newCount: 0,
    learningCount: 0,
    dueCount: 0,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
    onStudy: () => console.log('Study clicked'),
    onKaraoke: () => console.log('Karaoke clicked'),
  },
}
