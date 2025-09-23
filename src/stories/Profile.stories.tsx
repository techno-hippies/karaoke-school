import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { VideoThumbnail } from '../components/profile/VideoThumbnail';
import { ProfilePageView } from '../components/profile/ProfilePageView';
import { ClaimAccountPost } from '../components/profile/ClaimAccountPost';
import { ClaimAccountPage } from '../components/profile/ClaimAccountPage';

// Sample video data
const sampleVideos = Array.from({ length: 12 }, (_, i) => ({
  id: `video-${i + 1}`,
  thumbnailUrl: `https://picsum.photos/400/700?random=${i + 100}`,
  playCount: Math.floor(Math.random() * 1000000) + 1000,
}));

const meta: Meta<typeof ProfilePageView> = {
  title: 'Profile/ProfilePage',
  component: ProfilePageView,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onDesktopTabChange: { action: 'desktopTabChange' },
    onMobileTabChange: { action: 'mobileTabChange' },
    onNavigateHome: { action: 'navigateHome' },
    onEditProfile: { action: 'editProfile' },
    onShareProfile: { action: 'shareProfile' },
    onVideoClick: { action: 'videoClick' },
    onDisconnect: { action: 'disconnect' },
    onConnectWallet: { action: 'connectWallet' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Profile page with many videos (verified/claimed)
export const ProfileWithVideos: Story = {
  args: {
    username: 'ellas.gedanken',
    displayName: 'Ella🌸',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ella',
    bio: 'In meinen Zwanzigern😮‍💨\nFreche Sprüche und ein Augenzwinkern😉🥰',
    following: 55,
    followers: 15300,
    videos: sampleVideos,
    isOwnProfile: false,
    isVerified: true,
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: false,
    walletAddress: undefined,
  },
};

// Own profile view (verified/claimed)
export const OwnProfile: Story = {
  args: {
    username: 'myusername',
    displayName: 'My Display Name',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
    bio: 'This is my profile. I create amazing content!',
    following: 234,
    followers: 8900,
    videos: sampleVideos.slice(0, 6),
    isOwnProfile: true,
    isVerified: true,
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
  },
};

// Profile with no videos
export const EmptyProfile: Story = {
  args: {
    username: 'newuser',
    displayName: 'New User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=new',
    bio: 'Just joined! Excited to share content.',
    following: 0,
    followers: 0,
    videos: [],
    isOwnProfile: false,
    isVerified: false,
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: false,
    walletAddress: undefined,
  },
};

// Unclaimed profile with claimable amount
export const UnclaimedProfile: Story = {
  args: {
    username: 'unclaimed_creator',
    displayName: 'Popular Creator',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=unclaimed',
    bio: 'Creating amazing content daily! 🎥',
    following: 0,
    followers: 45600,
    videos: sampleVideos,
    isOwnProfile: false,
    isVerified: false,
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: false,
    walletAddress: undefined,
  },
};

// Individual component stories
const headerMeta: Meta<typeof ProfileHeader> = {
  title: 'Profile/ProfileHeader',
  component: ProfileHeader,
  parameters: {
    layout: 'fullscreen',
  },
};

export const HeaderOwnProfile: StoryObj<typeof ProfileHeader> = {
  args: {
    username: 'myusername',
    displayName: 'My Display Name',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
    bio: 'Content creator | Digital artist | Living my best life ✨',
    link: 'linktr.ee/myusername',
    following: 142,
    followers: 5234,
    isOwnProfile: true,
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-black">
        <Story />
      </div>
    ),
  ],
};

export const HeaderOtherProfile: StoryObj<typeof ProfileHeader> = {
  args: {
    username: 'creator123',
    displayName: 'Amazing Creator',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
    bio: 'Making cool videos every day! 🎬\nFollow for daily content',
    link: 'youtube.com/creator123',
    following: 892,
    followers: 125000,
    isOwnProfile: false,
    isFollowing: false,
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-black">
        <Story />
      </div>
    ),
  ],
};

export const HeaderFollowing: StoryObj<typeof ProfileHeader> = {
  args: {
    username: 'followeduser',
    displayName: 'Followed User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=followed',
    bio: 'Thanks for following! 💖',
    following: 234,
    followers: 45600,
    isOwnProfile: false,
    isFollowing: true,
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-black">
        <Story />
      </div>
    ),
  ],
};


// Mobile view
export const MobileProfile: Story = {
  args: {
    username: 'mobileuser',
    displayName: 'Mobile User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mobile',
    bio: 'Testing mobile view',
    following: 123,
    followers: 4567,
    videos: sampleVideos.slice(0, 9),
    isOwnProfile: false,
    isVerified: false,
    activeTab: 'profile',
    mobileTab: 'profile',
    isConnected: false,
    walletAddress: undefined,
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};

// Claim Account Page
export const ClaimAccount: StoryObj<typeof ClaimAccountPage> = {
  render: () => (
    <ClaimAccountPage
      username="ellas.gedanken"
      claimableAmount={347}
      onBack={() => console.log('Back clicked')}
      onClaim={() => console.log('Claim clicked')}
    />
  ),
  parameters: {
    layout: 'fullscreen',
  },
};