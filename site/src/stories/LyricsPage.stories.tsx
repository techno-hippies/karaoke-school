import type { Meta, StoryObj } from '@storybook/react-vite';
import { LyricsPage } from '../components/audio/LyricsPage';

const meta: Meta<typeof LyricsPage> = {
  title: 'Audio/LyricsPage',
  component: LyricsPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample lyrics - Heat of the Night by Scarlett X
const sampleLyrics = [
  { lineIndex: 0, originalText: "[Verse 1]", start: 0, end: 0, sectionMarker: true },
  { lineIndex: 1, originalText: "In the heat of the night, under city lights,", translations: { cn: "在夜晚的热浪中，在城市灯光下，", vi: "Trong sức nóng của đêm, dưới ánh đèn thành phố," }, start: 18.539, end: 21.859 },
  { lineIndex: 2, originalText: "You move like a flame, setting my heart right.", translations: { cn: "你像火焰般舞动，点燃我的心。", vi: "Em di chuyển như ngọn lửa, đốt cháy trái tim anh." }, start: 23.319, end: 26.459 },
  { lineIndex: 3, originalText: "With every step, you pull me in close,", translations: { cn: "每一步，你拉我靠近，", vi: "Với mỗi bước chân, em kéo anh lại gần," }, start: 27.819, end: 30.859 },
  { lineIndex: 4, originalText: "Your rhythm's got me, from my head to my toes.", translations: { cn: "你的节奏抓住我，从头到脚。", vi: "Nhịp điệu của em nắm lấy anh, từ đầu đến chân." }, start: 32.36, end: 35.68 },
  { lineIndex: 5, originalText: "[Pre-chorus]", start: 0, end: 0, sectionMarker: true },
  { lineIndex: 6, originalText: "Oh, baby, feel the beat, it's calling your name,", translations: { cn: "哦，宝贝，感受节拍，它在呼唤你的名字，", vi: "Ôi em yêu, cảm nhận nhịp điệu, nó đang gọi tên em," }, start: 36.54, end: 39.279 },
  { lineIndex: 7, originalText: "The congas are pounding, driving us insane.", translations: { cn: "康加鼓在敲击，让我们疯狂。", vi: "Trống conga đang đập, khiến chúng ta điên cuồng." }, start: 39.379, end: 41.659 },
  { lineIndex: 8, originalText: "Swing your hips, let the music take control,", translations: { cn: "摆动你的臀部，让音乐掌控一切，", vi: "Lắc hông đi, để âm nhạc kiểm soát," }, start: 41.779, end: 45.439 },
  { lineIndex: 9, originalText: "Tonight we're dancing, body and soul.", translations: { cn: "今晚我们跳舞，身心合一。", vi: "Tối nay chúng ta nhảy, thân xác và linh hồn." }, start: 47.259, end: 50.379 },
  { lineIndex: 10, originalText: "[Chorus]", start: 0, end: 0, sectionMarker: true },
  { lineIndex: 11, originalText: "Salsa, salsa, move with me now!", translations: { cn: "萨尔萨，萨尔萨，现在跟我动起来！", vi: "Salsa, salsa, di chuyển cùng anh ngay!" }, start: 50.919, end: 53.079 },
  { lineIndex: 12, originalText: "Twirl and spin, show me how!", translations: { cn: "旋转转圈，展示给我看！", vi: "Xoay và quay, cho anh xem nào!" }, start: 53.479, end: 55.459 },
  { lineIndex: 13, originalText: "Salsa, salsa, feel the fire!", translations: { cn: "萨尔萨，萨尔萨，感受火焰！", vi: "Salsa, salsa, cảm nhận ngọn lửa!" }, start: 55.5, end: 57.779 },
  { lineIndex: 14, originalText: "In your arms, my one desire!", translations: { cn: "在你怀中，我唯一的渴望！", vi: "Trong vòng tay em, khát khao duy nhất của anh!" }, start: 57.919, end: 60.039 },
  { lineIndex: 15, originalText: "Hey! (Hey!) Oh! (Oh!) Let's dance all night!", translations: { cn: "嘿！（嘿！）哦！（哦！）让我们跳整夜！", vi: "Này! (Này!) Ồ! (Ồ!) Hãy nhảy suốt đêm!" }, start: 60.119, end: 64.619 },
  { lineIndex: 16, originalText: "Salsa, salsa, hold me tight!", translations: { cn: "萨尔萨，萨尔萨，抱紧我！", vi: "Salsa, salsa, ôm anh chặt!" }, start: 64.659, end: 73.5 }
];

const sampleLyricsNoTranslation = [
  { lineIndex: 0, originalText: 'Walking down this empty street', start: 0, end: 4 },
  { lineIndex: 1, originalText: 'Shadows dancing at my feet', start: 4, end: 8 },
  { lineIndex: 2, originalText: 'Memories of what used to be', start: 8, end: 12 },
  { lineIndex: 3, originalText: 'Echo in the silence', start: 12, end: 16 },
  { lineIndex: 4, originalText: 'Time keeps moving on and on', start: 16, end: 20 },
  { lineIndex: 5, originalText: 'But I still feel you when you\'re gone', start: 20, end: 24 },
  { lineIndex: 6, originalText: 'In every sunrise, every dawn', start: 24, end: 28 },
  { lineIndex: 7, originalText: 'You\'re the melody', start: 28, end: 32 },
  { lineIndex: 8, originalText: 'That keeps me strong', start: 32, end: 36 },
  { lineIndex: 9, originalText: 'Through the darkness', start: 36, end: 40 },
  { lineIndex: 10, originalText: 'And the light', start: 40, end: 44 },
  { lineIndex: 11, originalText: 'You\'re my guiding star', start: 44, end: 48 },
  { lineIndex: 12, originalText: 'Through the night', start: 48, end: 52 }
];

export const Default: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/salsa/800/800',
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: sampleLyrics,
    selectedLanguage: 'cn',
    onBack: () => {
      console.log('Back clicked');
      alert('Back clicked');
    }
  }
};

export const NoTranslations: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/lyrics2/800/800',
    title: 'Melody',
    artist: 'The Wanderers',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    lyrics: sampleLyricsNoTranslation,
    onBack: () => {
      console.log('Back clicked');
    }
  }
};

export const VietnameseTranslation: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/salsa/800/800',
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: sampleLyrics,
    selectedLanguage: 'vi',
    onBack: () => {
      console.log('Back clicked');
    }
  }
};
