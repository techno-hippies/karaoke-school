import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEnsAddress, useEnsName, useEnsAvatar, useAccount, useConnect, useConnectors } from 'wagmi'
import { isAddress } from 'viem'
import { mainnet } from 'wagmi/chains'
import { useProfileDetails, FollowButton } from 'ethereum-identity-kit'
import { ProfileHeader } from './ProfileHeader'
import { VideoThumbnail } from './VideoThumbnail'
import { DesktopSidebar } from '../navigation/DesktopSidebar'
import { MobileFooter } from '../navigation/MobileFooter'
import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { User, ArrowLeft } from 'lucide-react'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { MobileHeader } from '../ui/mobile-header'
import { WalletOnboardingModal } from '../onboarding/WalletOnboardingModal'
import { WalletSelectionModal } from '../onboarding/WalletSelectionModal'
import { truncateAddress } from '../../lib/utils'

interface Video {
  id: string
  thumbnailUrl: string
  playCount: number
  videoUrl?: string
}

export const EnhancedProfilePage: React.FC = () => {
  const { addressOrEns } = useParams<{ addressOrEns: string }>()
  const navigate = useNavigate()
  const { goBackOrHome } = useNavigationHistory()
  const { address: connectedAddress, isConnected } = useAccount()
  const { connect } = useConnect()
  const connectors = useConnectors()
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'following' | 'profile'>('profile')
  const [mobileTab, setMobileTab] = useState<'home' | 'post' | 'profile'>('profile')
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showWalletSelection, setShowWalletSelection] = useState(false)
  
  // Check if the profile is for the connected user
  const isOwnProfile = connectedAddress && addressOrEns && 
    connectedAddress.toLowerCase() === addressOrEns.toLowerCase()
  
  // Detect if input is ENS name or address
  const isEnsName = addressOrEns?.includes('.') && !addressOrEns?.startsWith('0x')
  const isValidAddress = addressOrEns ? isAddress(addressOrEns) : false

  // Always use mainnet for ENS resolution
  const { data: resolvedAddress, isLoading: isResolvingAddress } = useEnsAddress({
    name: isEnsName ? addressOrEns : undefined,
    chainId: mainnet.id,
    enabled: isEnsName,
  })

  // Get ENS name if we have an address
  const { data: ensName, isLoading: isResolvingName } = useEnsName({
    address: (isValidAddress ? addressOrEns : resolvedAddress) as `0x${string}` | undefined,
    chainId: mainnet.id,
    enabled: isValidAddress || !!resolvedAddress,
  })

  // Get ENS avatar
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName || (isEnsName ? addressOrEns : undefined),
    chainId: mainnet.id,
    enabled: !!ensName || isEnsName,
  })

  // Final address to use
  const address = isValidAddress ? addressOrEns : resolvedAddress

  // Use ethereum-identity-kit for profile details - only if we have an address
  const { ens, detailsLoading } = useProfileDetails({
    addressOrName: address || '',
    enabled: !!address,
  })

  // Mock video data - in production this would come from your API/blockchain
  const [videos] = useState<Video[]>([
    { id: '1', thumbnailUrl: 'https://picsum.photos/400/500?random=10', playCount: 1250000 },
    { id: '2', thumbnailUrl: 'https://picsum.photos/400/500?random=11', playCount: 890000 },
    { id: '3', thumbnailUrl: 'https://picsum.photos/400/500?random=12', playCount: 2340000 },
    { id: '4', thumbnailUrl: 'https://picsum.photos/400/500?random=13', playCount: 567000 },
    { id: '5', thumbnailUrl: 'https://picsum.photos/400/500?random=14', playCount: 3456000 },
    { id: '6', thumbnailUrl: 'https://picsum.photos/400/500?random=15', playCount: 789000 },
  ])

  const handleDesktopTabChange = (tab: 'home' | 'discover' | 'following' | 'profile') => {
    if (tab === 'home') {
      navigate('/')
    } else if (tab === 'profile') {
      // Navigate to connected user's profile if they click profile button
      if (connectedAddress && !isOwnProfile) {
        navigate(`/#/profile/${connectedAddress}`)
      }
    } else {
      setActiveTab(tab)
    }
  }

  const handleMobileTabChange = (tab: 'home' | 'post' | 'profile') => {
    if (tab === 'home') {
      navigate('/')
    } else if (tab === 'post') {
      console.log('Create post')
    }
    setMobileTab(tab)
  }

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/#/profile/${addressOrEns}`
    navigator.clipboard.writeText(shareUrl)
    console.log('Profile URL copied:', shareUrl)
  }

  const handleConnectWallet = () => {
    setShowWalletModal(true)
  }

  // Loading state with skeleton
  if (isResolvingAddress || isResolvingName || detailsLoading) {
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar 
          activeTab={activeTab}
          onTabChange={handleDesktopTabChange}
          onCreatePost={() => console.log('Create post')}
          isConnected={isConnected}
          walletAddress={connectedAddress}
          onDisconnect={() => disconnect()}
          onConnectWallet={handleConnectWallet}
        />
        
        <div className="flex-1 overflow-y-auto md:ml-20 lg:ml-64">
          <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
            {/* Mobile Header Skeleton */}
            <MobileHeader title="" />

            {/* Profile Header Skeleton */}
            <div className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              
              <div className="flex gap-6 mt-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
              
              <Skeleton className="h-10 w-full mt-4" />
            </div>

            {/* Video Grid Skeleton */}
            <div className="px-1 md:px-4 mt-4">
              <div className="grid grid-cols-3 gap-1">
                {[...Array(9)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[9/16]" />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />
      </div>
    )
  }

  // No profile address to view AND user not connected - show sign in
  if (!address && !isConnected) {
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar 
          activeTab={activeTab}
          onTabChange={handleDesktopTabChange}
          onCreatePost={() => console.log('Create post')}
          isConnected={isConnected}
          walletAddress={connectedAddress}
          onDisconnect={() => disconnect()}
          onConnectWallet={handleConnectWallet}
        />
        
        <div className="flex-1 flex items-center justify-center md:ml-20 lg:ml-64">
          <div className="text-center">
            <div className="mb-6 mx-auto w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center">
              <User className="h-12 w-12 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Sign in to view profile</h2>
            <p className="text-neutral-400 mb-6">Connect your wallet to access your profile</p>
            <Button 
              onClick={handleConnectWallet}
              className="bg-red-500 hover:bg-red-600 text-white"
              size="lg"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
        
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />
        
        <WalletOnboardingModal
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
          onConnectWithJoyID={() => {
            // Use injected connector for JoyID simulation
            const injectedConnector = connectors.find(c => c.type === 'injected')
            if (injectedConnector) {
              connect({ connector: injectedConnector })
            }
            setShowWalletModal(false)
          }}
          onShowOtherOptions={() => {
            // Show wallet selection modal
            setShowWalletModal(false)
            setShowWalletSelection(true)
          }}
        />
        <WalletSelectionModal
          open={showWalletSelection}
          onOpenChange={setShowWalletSelection}
        />
      </div>
    )
  }

  // Invalid address/ENS
  if (!address) {
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar 
          activeTab={activeTab}
          onTabChange={handleDesktopTabChange}
          onCreatePost={() => console.log('Create post')}
          isConnected={isConnected}
          walletAddress={connectedAddress}
          onDisconnect={() => disconnect()}
          onConnectWallet={handleConnectWallet}
        />
        
        <div className="flex-1 flex items-center justify-center md:ml-20 lg:ml-64">
          <div className="text-center">
            <div className="mb-6 mx-auto w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center">
              <User className="h-12 w-12 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Profile not found</h2>
            <p className="text-neutral-400">Invalid address or ENS name</p>
          </div>
        </div>
        
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />
      </div>
    )
  }

  // Build profile data from ENS
  const displayAddress = address ? truncateAddress(address) : ''
  
  // username: shows ENS name (vitalik.eth) or truncated address (0x1234...5678)
  const username = ensName || displayAddress
  
  // displayName: only set if user has configured a display name in ENS records
  // This is different from the ENS name itself
  const displayName = ens?.displayName || ens?.records?.['name'] || ''
  
  const profileData = {
    address: address as string,
    username: username, // vitalik.eth or 0x1234...5678
    displayName: displayName, // Empty or their chosen display name
    avatarUrl: ensAvatar || ens?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    bio: ens?.description || '',
    following: 892, // Mock data
    followers: 125000, // Mock data
    likes: 5670000, // Mock data
    isVerified: !!ensName,
    isOwnProfile: isOwnProfile || false,
    socialLinks: ens?.records ? {
      twitter: ens.records['com.twitter'],
      github: ens.records['com.github'],
      website: ens.records['url'],
    } : undefined,
  }

  return (
    <div className="h-screen bg-black flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar 
        activeTab={activeTab}
        onTabChange={handleDesktopTabChange}
        onCreatePost={() => console.log('Create post')}
        isConnected={isConnected}
        walletAddress={connectedAddress}
        onDisconnect={() => disconnect()}
        onConnectWallet={handleConnectWallet}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto md:ml-20 lg:ml-64">
        <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
          {/* Mobile Header - always show, empty title when no display name */}
          <div className="md:hidden flex items-center p-4 border-b border-neutral-800 min-h-[72px]">
            {!profileData.isOwnProfile && (
              <button
                onClick={() => goBackOrHome()}
                className="p-2 hover:bg-neutral-800 rounded-full cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            )}
            <span className="ml-3 font-semibold text-white truncate">
              {profileData.displayName || '\u00A0'}
            </span>
          </div>

          <ProfileHeader
            username={profileData.username}
            displayName={profileData.displayName}
            bio={profileData.bio}
            followers={profileData.followers}
            following={profileData.following}
            likes={profileData.likes}
            avatarUrl={profileData.avatarUrl}
            isFollowing={false}
            isOwnProfile={profileData.isOwnProfile}
            isVerified={profileData.isVerified}
            onFollowClick={() => console.log('Follow toggle')}
            onEditClick={() => navigate('/edit-profile')}
            onMoreClick={handleShare}
          />

          {/* Custom Follow Button from ethereum-identity-kit - only show if not own profile */}
          {!profileData.isOwnProfile && (
            <div className="px-4 mb-4">
              <FollowButton 
                address={address as `0x${string}`}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg"
              />
            </div>
          )}

          {/* Social Links */}
          {profileData.socialLinks && (
            <div className="px-4 mb-4 flex gap-2">
              {profileData.socialLinks.twitter && (
                <a 
                  href={`https://twitter.com/${profileData.socialLinks.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 hover:text-white"
                >
                  Twitter
                </a>
              )}
              {profileData.socialLinks.github && (
                <a 
                  href={`https://github.com/${profileData.socialLinks.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 hover:text-white"
                >
                  GitHub
                </a>
              )}
              {profileData.socialLinks.website && (
                <a 
                  href={profileData.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 hover:text-white"
                >
                  Website
                </a>
              )}
            </div>
          )}
          
          {/* Video Grid */}
          <div className="px-1 md:px-4">
            <div className="grid grid-cols-3 gap-1">
              {videos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  thumbnailUrl={video.thumbnailUrl}
                  playCount={video.playCount}
                  onClick={() => console.log('Video clicked:', video.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Footer */}
      <MobileFooter
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
      />
    </div>
  )
}