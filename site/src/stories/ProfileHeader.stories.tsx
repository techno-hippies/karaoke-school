import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileHeader } from '../components/profile/ProfileHeader';

const meta: Meta<typeof ProfileHeader> = {
  title: 'Profile/ProfileHeader',
  component: ProfileHeader,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-black">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnProfile: Story = {
  args: {
    username: 'myusername',
    displayName: 'My Display Name',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
    bio: 'Content creator | Digital artist | Living my best life ✨',
    link: 'linktr.ee/myusername',
    following: 142,
    followers: 5234,
    likes: 48700,
    isOwnProfile: true,
  },
};

export const OtherProfile: Story = {
  args: {
    username: 'creator123',
    displayName: 'Amazing Creator',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
    bio: 'Making cool videos every day! 🎬\nFollow for daily content',
    link: 'youtube.com/creator123',
    following: 892,
    followers: 125000,
    likes: 2400000,
    isOwnProfile: false,
    isFollowing: false,
  },
};

export const Following: Story = {
  args: {
    username: 'followeduser',
    displayName: 'Followed User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=followed',
    bio: 'Thanks for following! 💖',
    following: 234,
    followers: 45600,
    likes: 890000,
    isOwnProfile: false,
    isFollowing: true,
  },
};

export const NoAvatar: Story = {
  args: {
    username: 'noavatar',
    displayName: 'No Avatar User',
    bio: 'Testing without custom avatar',
    following: 10,
    followers: 100,
    likes: 1000,
    isOwnProfile: false,
    isFollowing: false,
  },
};

export const LongBio: Story = {
  args: {
    username: 'longbio',
    displayName: 'Long Bio User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=longbio',
    bio: 'This is a very long bio that tests how the component handles multiple lines of text. I create content about technology, gaming, and lifestyle. Follow me for daily updates and behind-the-scenes content!',
    link: 'mywebsite.com/links',
    following: 500,
    followers: 10000,
    likes: 250000,
    isOwnProfile: false,
    isFollowing: false,
  },
};

export const MillionFollowers: Story = {
  args: {
    username: 'megastar',
    displayName: 'Mega Star ⭐',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=megastar',
    bio: 'Official account | 10M on YouTube',
    link: 'linktr.ee/megastar',
    following: 2,
    followers: 5600000,
    likes: 125000000,
    isOwnProfile: false,
    isFollowing: false,
  },
};