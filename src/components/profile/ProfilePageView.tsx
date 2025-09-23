import React from 'react';
import { ProfileHeader } from './ProfileHeader';
import { VideoThumbnail } from './VideoThumbnail';
import { DesktopSidebar } from '../navigation/DesktopSidebar';
import { MobileFooter } from '../navigation/MobileFooter';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { FollowButton, ProfileStats } from 'ethereum-identity-kit';

interface Video {
  id: string;
  thumbnailUrl: string;
  thumbnailSourceUrl?: string; // Added for client-side generation
  playCount: number;
  videoUrl?: string;
}

interface ProfilePageViewProps {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  following: number;
  followers: number;
  isVerified: boolean;
  isOwnProfile: boolean;
  videos: Video[];
  activeTab: 'home' | 'discover' | 'following' | 'profile';
  mobileTab: 'home' | 'post' | 'profile';
  
  // Wallet props
  isConnected?: boolean;
  walletAddress?: string;
  connectedAddress?: string; // Connected user's address for follow button
  profileAddress?: string; // The profile being viewed
  isFollowing?: boolean;
  isFollowLoading?: boolean;
  
  // Callbacks
  onDesktopTabChange: (tab: 'home' | 'discover' | 'following' | 'profile') => void;
  onMobileTabChange: (tab: 'home' | 'post' | 'profile') => void;
  onNavigateHome: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onVideoClick: (video: Video) => void;
  onDisconnect?: () => void;
  onConnectWallet?: () => void;
}

export const ProfilePageView: React.FC<ProfilePageViewProps> = ({
  username,
  displayName,
  avatarUrl,
  bio,
  following,
  followers,
  isVerified,
  isOwnProfile,
  videos,
  activeTab,
  mobileTab,
  isConnected,
  walletAddress,
  connectedAddress,
  profileAddress,
  isFollowing = false,
  isFollowLoading = false,
  onDesktopTabChange,
  onMobileTabChange,
  onNavigateHome,
  onEditProfile,
  onShareProfile,
  onVideoClick,
  onDisconnect,
  onConnectWallet,
}) => {
  return (
    <div className="h-screen bg-black flex">
      
      {/* Desktop Sidebar */}
      <DesktopSidebar 
        activeTab={activeTab}
        onTabChange={onDesktopTabChange}
        onCreatePost={() => console.log('Create post')}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onDisconnect={onDisconnect}
        onConnectWallet={onConnectWallet}
      />
      
      {/* Main Content - with proper margin for fixed sidebar */}
      <div className="flex-1 overflow-y-auto md:ml-64">
        <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
          {/* Desktop Logout button - top right */}
          {isConnected && isOwnProfile && (
            <div className="hidden md:block absolute top-4 right-4 z-50">
              <button
                onClick={onDisconnect}
                className="p-2 hover:bg-neutral-800 rounded-full cursor-pointer"
              >
                <LogOut className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
          )}
          
          {/* Mobile Header */}
          <div className="md:hidden flex items-center p-4 border-b border-neutral-800">
            {!isOwnProfile ? (
              <button
                onClick={() => {
                  // If there's history, go back; otherwise go to home
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    onNavigateHome();
                  }
                }}
                className="p-2 hover:bg-neutral-800 rounded-full cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            ) : (
              <div className="w-9" /> // Left spacer when no back button
            )}
            <h1 className="flex-1 text-center font-semibold text-lg">
              {displayName || username}
            </h1>
            {isConnected && isOwnProfile ? (
              <button
                onClick={onDisconnect}
                className="p-2 hover:bg-neutral-800 rounded-full cursor-pointer"
              >
                <LogOut className="h-5 w-5 text-neutral-400" />
              </button>
            ) : (
              <div className="w-9" /> // Right spacer when no logout button
            )}
          </div>

          {/* Profile Header */}
          <ProfileHeader
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            bio={bio}
            following={following}
            followers={followers}
            isVerified={isVerified}
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isFollowLoading={isFollowLoading}
            connectedAddress={connectedAddress}
            profileAddress={profileAddress}
            onEditClick={onEditProfile}
            onMoreClick={onShareProfile}
            onFollowClick={onConnectWallet} // Handle follow with auth flow
          />

          {/* Video Grid */}
          <div className="px-1 md:px-4 mt-4">
            <div className="grid grid-cols-3 gap-1">
              {videos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  thumbnailUrl={video.thumbnailUrl}
                  thumbnailSourceUrl={video.thumbnailSourceUrl}
                  playCount={video.playCount}
                  videoUrl={video.videoUrl}
                  onClick={() => onVideoClick(video)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Footer - Only show for own profile */}
      {isOwnProfile && (
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={onMobileTabChange}
        />
      )}
    </div>
  );
};