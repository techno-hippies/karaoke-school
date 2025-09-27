import type { Meta, StoryObj } from '@storybook/react';
import { PostEditor } from '../components/ui/PostEditor';

const meta: Meta<typeof PostEditor> = {
  title: 'Content Creation/PostEditor',
  component: PostEditor,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
};

export const WithVideoThumbnail: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=1',
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
};

export const WithPrefilledCaption: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=2',
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  play: async ({ canvasElement }) => {
    // Auto-fill caption for demo
    const textarea = canvasElement.querySelector('textarea');
    if (textarea) {
      textarea.value = "Just recorded this amazing karaoke performance! 🎤✨ #karaoke #singing #music";
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

export const LongCaption: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=3',
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  play: async ({ canvasElement }) => {
    // Auto-fill long caption for demo
    const textarea = canvasElement.querySelector('textarea');
    if (textarea) {
      textarea.value = "This was such an incredible experience! I've been practicing this song for weeks and finally got the courage to record it. The segment picker made it so easy to choose the perfect part of the song, and the lyrics display helped me stay on track. Can't wait to share more performances with everyone! 🎵 #karaoke #music #singing #performance #practice #courage #lyrics #amazing #experience #sharing #community";
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

export const NearCharacterLimit: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=4',
    maxCaptionLength: 1000,
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  play: async ({ canvasElement }) => {
    // Auto-fill caption near character limit
    const textarea = canvasElement.querySelector('textarea');
    if (textarea) {
      const longCaption = "This karaoke app is absolutely incredible! The way it seamlessly integrates song selection, segment picking, and video recording is mind-blowing. I love how the lyrics display in real-time sync with the audio, making it so much easier to stay on track while singing. The camera quality is fantastic, and the audio sync is perfect. I've tried many karaoke apps before, but this one stands out for its user-friendly interface and professional features. The ability to choose specific segments of songs is a game-changer - I can focus on my favorite parts or practice challenging sections. The recording process is smooth and intuitive, and I love how I can preview everything before posting. This app has reignited my passion for singing and sharing music with others. Can't wait to see what features they add next! Highly recommend to anyone who loves music and wants to share their voice with the world. Thank you to the developers for creating such an amazing platform! 🎤🎵✨ #karaoke #music #singing #app #amazing #recording #lyrics #sync #quality #features #passion #sharing #recommend #developers #platform";
      textarea.value = longCaption.substring(0, 980); // Near but under limit
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

export const EmptyState: Story = {
  args: {
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the empty state without a video thumbnail, displaying the placeholder preview.',
      },
    },
  },
};

export const Desktop: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=5',
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

export const Interactive: Story = {
  args: {
    videoThumbnail: 'https://picsum.photos/400/600?random=6',
    onBack: () => console.log('Back clicked'),
    onPost: (caption) => console.log('Posted with caption:', caption),
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive story for testing the component behavior. Try typing in the caption field and clicking the Post button.',
      },
    },
  },
};