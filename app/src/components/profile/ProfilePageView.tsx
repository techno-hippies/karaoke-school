import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { ProfileHeader } from './ProfileHeader'
import { VideoGrid, type Video } from './VideoGrid'
import { DesktopSidebar } from '../navigation/DesktopSidebar'
import { MobileFooter } from '../navigation/MobileFooter'
import { BackButton } from '@/components/ui/back-button'
import { SubscriptionDialog } from './SubscriptionDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Leaderboard, type LeaderboardEntry } from '@/components/class/Leaderboard'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface ProfilePageViewProps {
  // Profile data
  profile: {
    username: string
    displayName?: string
    avatarUrl: string
    following: number
    followers: number
    isVerified: boolean
    isOwnProfile: boolean
  }

  // Videos
  videos: Video[]
  videosLoading?: boolean

  // Favorite Artists
  favoriteArtists?: LeaderboardEntry[]

  // Follow state
  followState: {
    isFollowing: boolean
    isLoading: boolean
  }

  // Navigation
  activeTab: 'home' | 'study' | 'post' | 'inbox' | 'profile'
  mobileTab: 'home' | 'post' | 'profile'
  onDesktopTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void
  onMobileTabChange: (tab: 'home' | 'post' | 'profile') => void

  // Wallet
  isConnected?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
  onDisconnect?: () => void

  // Handlers
  onEditProfile: () => void
  onFollowClick: () => void
  onMessageClick: () => void
  onShareProfile: () => void
  onVideoClick: (video: Video) => void
  onNavigateHome: () => void
}

/**
 * ProfilePageView - Main profile layout
 * Combines desktop sidebar, mobile header/footer, profile header, and video grid
 */
export function ProfilePageView({
  profile,
  videos,
  videosLoading,
  favoriteArtists = [],
  followState,
  activeTab,
  mobileTab,
  onDesktopTabChange,
  onMobileTabChange,
  isConnected,
  walletAddress,
  onConnectWallet,
  onDisconnect,
  onEditProfile,
  onFollowClick,
  onMessageClick,
  onShareProfile,
  onVideoClick,
  onNavigateHome,
}: ProfilePageViewProps) {
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)

  return (
    <div className="h-screen bg-neutral-900">
      {/* Desktop Sidebar - fixed, removed from flow */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onDesktopTabChange}
        onCreatePost={() => console.log('Create post')}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
        onDisconnect={onDisconnect}
      />

      {/* Main Content - margin pushes content right of fixed sidebar */}
      <ScrollArea className="h-full md:ml-64">
        <div className="min-h-screen bg-neutral-900 pb-20 md:pb-0">

          {/* Desktop Logout - top right */}
          {isConnected && profile.isOwnProfile && (
            <div className="hidden md:block absolute top-4 right-4 z-50">
              <button
                onClick={onDisconnect}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
              >
                <SignOut className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
          )}

          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-neutral-800">
            {/* Left: Back button or spacer */}
            {!profile.isOwnProfile ? (
              <BackButton onClick={onNavigateHome} />
            ) : (
              <div className="w-12" />
            )}

            {/* Center: Title */}
            <h1 className="text-center font-semibold text-base text-foreground flex-1">
              {profile.displayName || profile.username}
            </h1>

            {/* Right: Logout button or spacer */}
            {isConnected && profile.isOwnProfile ? (
              <button
                onClick={onDisconnect}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
              >
                <SignOut className="h-5 w-5 text-neutral-400" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>

          {/* Profile Header */}
          <ProfileHeader
            username={profile.username}
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            following={profile.following}
            followers={profile.followers}
            isVerified={profile.isVerified}
            isOwnProfile={profile.isOwnProfile}
            isFollowing={followState.isFollowing}
            isFollowLoading={followState.isLoading}
            onEditClick={onEditProfile}
            onFollowClick={onFollowClick}
            onSubscribeClick={() => setSubscriptionDialogOpen(true)}
            onMessageClick={onMessageClick}
            onMoreClick={onShareProfile}
          />

          {/* Tabs: Videos | Favorite Artists */}
          <div className="mt-4 mb-4">
            <Tabs defaultValue="videos" className="w-full">
              <div className="px-4">
                <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                  <TabsTrigger value="artists">Favorite Artists</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="videos" className="mt-4">
                <VideoGrid
                  videos={videos}
                  isLoading={videosLoading}
                  onVideoClick={onVideoClick}
                />
              </TabsContent>

              <TabsContent value="artists" className="mt-4 px-4">
                {favoriteArtists.length > 0 ? (
                  <Leaderboard entries={favoriteArtists} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No favorite artists yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </ScrollArea>

      {/* Mobile Footer - only for own profile */}
      {profile.isOwnProfile && (
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={onMobileTabChange}
        />
      )}

      {/* Subscription Dialog */}
      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        username={profile.username}
        userAvatar={profile.avatarUrl}
        onSubscribe={() => {
          console.log('Subscribe clicked for', profile.username)
          setSubscriptionDialogOpen(false)
        }}
      />
    </div>
  )
}
