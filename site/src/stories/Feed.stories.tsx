import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoPost } from '../components/feed/VideoPost';

const meta: Meta<typeof VideoPost> = {
  title: 'Feed/VideoPost',
  component: VideoPost,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'iphone12',
    },
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    username: "creator_name",
    description: "Amazing content here! Check this out #fyp #viral",
    likes: 125000,
    comments: 892,
    shares: 1250,
    thumbnailUrl: "https://picsum.photos/400/700",
    musicTitle: "Trending Sound - Artist Name",
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
  },
};