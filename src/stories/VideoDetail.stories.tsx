import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoDetail } from '../components/feed/VideoDetail';

const meta: Meta<typeof VideoDetail> = {
  title: 'Feed/VideoDetail',
  component: VideoDetail,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    username: "revolve",
    description: "Celebrity Stylist @jaredellner takes us behind the scenes of his career, from dressing some of the most iconic names in fashion to navigating unforgettable moments like wardrobe mishaps, get the inside scoop on his philosophy, style instincts, & more 👀 Watch the full confessional now, only on REVOLVE's YouTube channel #revolve #jaredellner #celebritystylist #stylist #interview #fyp",
    likes: 39,
    comments: 2,
    shares: 7,
    musicTitle: "original sound - Revolve",
    thumbnailUrl: "https://picsum.photos/400/700?random=1",
    creatorHandle: "Revolve",
    onClose: () => console.log('Close clicked'),
  },
};

export const WithVideo: Story = {
  args: {
    username: "dance_moves",
    description: "New dance tutorial! Follow along and tag me in your videos 💃✨ #dance #tutorial #fyp",
    likes: 89000,
    comments: 1200,
    shares: 5600,
    musicTitle: "Dance Beat - DJ Mix",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnailUrl: "https://picsum.photos/400/700?random=3",
    creatorHandle: "Dance Pro",
    onClose: () => console.log('Close clicked'),
    currentVideoIndex: 2,
    totalVideos: 5,
    onNavigatePrevious: () => console.log('Navigate to previous video'),
    onNavigateNext: () => console.log('Navigate to next video'),
  },
};

export const LensProfile: Story = {
  args: {
    username: "karaokeschool",
    description: "Building the future of decentralized social media on Lens Protocol! 🌿 Join the revolution #lens #web3 #defi",
    likes: 156000,
    comments: 2400,
    shares: 8900,
    musicTitle: "Future Sounds - Electronic",
    thumbnailUrl: "https://picsum.photos/400/700?random=4",
    creatorHandle: "Karaoke School",
    creatorId: "lens/karaokeschool",
    onClose: () => console.log('Close clicked'),
  },
};

export const HighEngagement: Story = {
  args: {
    username: "viral_creator",
    description: "This video is going viral! Can't believe the response 🚀 Thanks to everyone who shared, liked, and commented. You're amazing! Let's keep this energy going #viral #trending #amazing #grateful #community",
    likes: 2500000,
    comments: 45000,
    shares: 250000,
    musicTitle: "Trending Sound - Viral Hit",
    thumbnailUrl: "https://picsum.photos/400/700?random=2",
    creatorHandle: "Viral Creator",
    onClose: () => console.log('Close clicked'),
    currentVideoIndex: 0,
    totalVideos: 3,
    onNavigatePrevious: () => console.log('Navigate to previous video (disabled - first video)'),
    onNavigateNext: () => console.log('Navigate to next video'),
  },
};