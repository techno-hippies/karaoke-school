import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProfilePageView } from './ProfilePageView';
import { VideoDetail } from '../feed/VideoDetail';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  useProfileDetails,
  useProfileStats
} from 'ethereum-identity-kit';
import { useAccount, useEnsAddress, useDisconnect } from 'wagmi';
import { useProfileVideos, getCreatorHandle } from '../../hooks/useProfileVideos';
import { useLensProfileVideos } from '../../hooks/useLensProfileVideos';
import { useDisplayAuth } from '../../hooks/useDisplayAuth';
import { useLensFollows } from '../../hooks/useLensFollows';

interface Video {
  id: string;
  thumbnailUrl: string;
  playCount: number;
  videoUrl?: string;
}

// For Lens profiles, we use native Lens follow protocol
// For regular profiles, we use ethereum-identity-kit for ENS/profile data

export const ProfilePage: React.FC = () => {
  const { addressOrEns, username } = useParams<{ addressOrEns?: string; username?: string }>();

  // Determine if this is a Lens profile and construct the identifier
  const isLensProfile = !!username; // If username param exists, we're on the /profile/lens/:username route
  const profileIdentifier = isLensProfile ? username : addressOrEns;


  // console.log('[ProfilePage] Rendering profile:', {
  //   isLensProfile,
  //   profileIdentifier,
  //   addressOrEns,
  //   username
  // });
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();

  // Shared authentication logic
  const {
    displayAddress,
    displayConnected,
    connectedAddress,
    isAuthenticated,
    hasInitialized,
    connectedWalletAddress,
    isOwnProfile
  } = useDisplayAuth();
  const { openConnectModal } = useConnectModal();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'following' | 'profile'>('profile');
  const [mobileTab, setMobileTab] = useState<'home' | 'post' | 'profile'>('profile');
  
  // Get final connected address from wallet
  const finalConnectedAddress = connectedAddress;

  // Debug logging for authentication state
  React.useEffect(() => {
    console.log('[ProfilePage] Authentication state:', {
      isAuthenticated,
      hasInitialized,
      connectedWalletAddress,
      displayAddress,
      displayConnected
    });
  }, [isAuthenticated, hasInitialized, connectedWalletAddress, displayAddress, displayConnected]);
  
  // Check if viewing own profile using shared logic
  const isOwn = isOwnProfile(profileIdentifier);
  
  // Fetch profile data from ethereum-identity-kit (only for non-Lens profiles)
  const { ens, detailsLoading } = useProfileDetails({
    addressOrName: isLensProfile ? '' : (profileIdentifier || ''),
    enabled: !isLensProfile && !!profileIdentifier,
  });

  // Resolve ENS name to address if needed (only for non-Lens profiles)
  const { data: ensResolvedAddress } = useEnsAddress({
    name: !isLensProfile && profileIdentifier?.endsWith('.eth') ? profileIdentifier : undefined,
    chainId: 1, // mainnet
  });
  
  // Use resolved address: from ENS resolution, from ens.records, or if already an address
  // For Lens profiles, we'll get the account address from their posts/profile data
  const profileAddress = isLensProfile
    ? undefined // Lens profiles use account addresses from their profile data
    : (ensResolvedAddress ||
       ens?.records?.['eth'] ||
       ens?.address ||
       (profileIdentifier?.startsWith('0x') ? profileIdentifier : undefined) ||
       (profileIdentifier === 'vitalik.eth' ? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' : undefined));
  
  // Get Lens account address from their posts (if available)
  const [lensAccountAddress, setLensAccountAddress] = useState<string | undefined>(undefined);
  
  // Use Lens follows for Lens profiles
  const lensFollowHook = useLensFollows({
    targetAccountAddress: lensAccountAddress,
    initialFollowState: false
  });
  
  // Fetch follower/following stats - needs an address, not ENS name
  // Try calling it differently - maybe the API changed
  const statsResult = profileAddress ? useProfileStats(profileAddress) : { followers: undefined, following: undefined };
  
  // Extract stats with better error handling
  const stats = statsResult?.stats;
  const statsLoading = statsResult?.isLoading;
  
  // Fetch real videos - use appropriate hook based on profile type
  const { data: blockchainVideos, isLoading: regularVideosLoading } = useProfileVideos(
    isLensProfile ? undefined : profileIdentifier
  );
  const { data: lensVideos, isLoading: lensVideosLoading } = useLensProfileVideos(
    isLensProfile ? profileIdentifier : undefined
  );

  // Combine video data and loading states
  const allVideos = isLensProfile ? lensVideos : blockchainVideos;
  const videosLoading = isLensProfile ? lensVideosLoading : regularVideosLoading;

  // Extract Lens account address from profile lookup
  React.useEffect(() => {
    if (isLensProfile && profileIdentifier) {
      // For now, we'll use a known mapping, but this should be fetched from Lens API
      const knownMappings: Record<string, string> = {
        'addisonre1218': '0xfbc6e6F734253fe36aFF3FC96BB13B4968B71E08',
        'theevaelfie_t1': '0xf1a92Ec7cbb29b41942F0d9D4eEeABFEdC22ef9d',
        'bellapoarch_t1': '0xA40347E56F3d400800545e08B5305bE9ccA601e5',
      };

      const accountAddress = knownMappings[profileIdentifier];
      if (accountAddress) {
        setLensAccountAddress(accountAddress);
        console.log(`[ProfilePage] Set Lens account address for ${profileIdentifier}:`, accountAddress);
      } else {
        console.log(`[ProfilePage] No account address mapping found for ${profileIdentifier}`);
      }
    }
  }, [isLensProfile, profileIdentifier]);

  // Get creator handle for display
  const creatorHandle = getCreatorHandle(profileIdentifier);

  // Display username logic - handle Lens profiles differently
  const displayUsername = isLensProfile
    ? profileIdentifier // For Lens profiles, show the username directly
    : (creatorHandle || ens?.name || (profileIdentifier?.startsWith('0x')
        ? `${profileIdentifier.slice(0, 6)}...${profileIdentifier.slice(-4)}`
        : profileIdentifier || 'karaokeschool'));
  
  // Use real profile data from ethereum-identity-kit and fallback to defaults
  const profileData = useMemo(() => ({
    username: displayUsername,
    displayName: isLensProfile
      ? displayUsername // For Lens, use the username as display name
      : (ens?.displayName || displayUsername), // Use ENS display name or username
    avatarUrl: isLensProfile
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileIdentifier}` // Use avataaars for Lens profiles
      : (ens?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${profileIdentifier}`),
    bio: isLensProfile
      ? `Lens Protocol creator: @${profileIdentifier}` // Default bio for Lens profiles
      : (ens?.records?.description || ens?.bio || ''), // ENS description field is the bio
    // Check different possible locations for stats
    following: statsResult?.following || statsResult?.data?.following || 0,
    followers: statsResult?.followers || statsResult?.data?.followers || 0,
    isVerified: false, // This would come from your verification system
    isOwnProfile: isOwn,
    connectedAddress: connectedAddress, // Pass connected address for follow button
    // Use real videos only - no placeholders
    videos: allVideos && allVideos.length > 0
      ? allVideos.map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          thumbnailSourceUrl: v.thumbnailSourceUrl, // Added for client-side generation
          playCount: v.playCount || 0,
          videoUrl: v.videoUrl
        }))
      : [], // No fallback videos
    videosLoading: videosLoading
  }), [
    displayUsername,
    isLensProfile,
    profileIdentifier,
    ens?.displayName,
    ens?.avatar,
    ens?.records?.description,
    ens?.bio,
    statsResult?.following,
    statsResult?.data?.following,
    statsResult?.followers,
    statsResult?.data?.followers,
    isOwnProfile,
    connectedAddress,
    allVideos,
    videosLoading
  ]);
  
  const handleDesktopTabChange = useCallback((tab: 'home' | 'discover' | 'following' | 'profile') => {
    if (tab === 'home') {
      navigate('/');
    } else if (tab === 'profile') {
      // Navigate to connected user's profile if clicking from another user's profile
      if (connectedAddress && !isOwn) {
        navigate(`/profile/${connectedAddress}`);
      }
    } else {
      setActiveTab(tab);
    }
  }, [navigate, connectedWalletAddress, isOwnProfile]);

  const handleMobileTabChange = useCallback((tab: 'home' | 'post' | 'profile') => {
    if (tab === 'home') {
      navigate('/');
    } else if (tab === 'post') {
      console.log('Create post');
    }
    // profile tab stays on current page
    setMobileTab(tab);
  }, [navigate]);

  const handleVideoClick = useCallback((video: Video) => {
    const index = allVideos?.findIndex(v => v.id === video.id) ?? 0;
    setCurrentVideoIndex(index);
    setSelectedVideo(video);
  }, [allVideos]);

  const handleNavigatePrevious = useCallback(() => {
    if (!allVideos || currentVideoIndex <= 0) return;
    const newIndex = currentVideoIndex - 1;
    setCurrentVideoIndex(newIndex);
    setSelectedVideo(allVideos[newIndex]);
  }, [allVideos, currentVideoIndex]);

  const handleNavigateNext = useCallback(() => {
    if (!allVideos || currentVideoIndex >= allVideos.length - 1) return;
    const newIndex = currentVideoIndex + 1;
    setCurrentVideoIndex(newIndex);
    setSelectedVideo(allVideos[newIndex]);
  }, [allVideos, currentVideoIndex]);

  const handleEditProfile = useCallback(() => {
    navigate('/edit-profile');
  }, [navigate]);

  const handleShareProfile = useCallback(async () => {
    const profilePath = isLensProfile ? `/profile/lens/${profileIdentifier}` : `/profile/${profileIdentifier}`;
    const shareUrl = `${window.location.origin}/#${profilePath}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Profile on TikTok`,
          text: profileData.bio || 'Check out this profile',
          url: shareUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      console.log('Link copied to clipboard');
    }
  }, [isLensProfile, profileIdentifier, profileData.bio]);

  const handleConnectWallet = async () => {
    // This is called when follow button is clicked

    if (isLensProfile) {
      // For Lens profiles, use Lens follow protocol
      if (lensFollowHook.canFollow) {
        await lensFollowHook.toggleFollow();
      } else {
        // Need wallet connection - show modal
        openConnectModal?.();
      }
    } else {
      // For non-Lens profiles, just show connect modal for now
      // Could implement EFP follows later if needed
      openConnectModal?.();
    }
  };
  
  // Get follow state and loading status
  const isFollowing = isLensProfile ? lensFollowHook.isFollowing : false;
  const isFollowLoading = isLensProfile ? lensFollowHook.isLoading : false;

  return (
    <>
      <ProfilePageView
        {...profileData}
        activeTab={activeTab}
        mobileTab={mobileTab}
        isConnected={displayConnected}
        walletAddress={displayAddress}
        connectedAddress={connectedAddress}
        profileAddress={profileAddress}  // Pass resolved address, not ENS
        isFollowing={isFollowing}
        isFollowLoading={isFollowLoading}
        onDesktopTabChange={handleDesktopTabChange}
        onMobileTabChange={handleMobileTabChange}
        onNavigateHome={() => navigate('/')}
        onEditProfile={handleEditProfile}
        onShareProfile={handleShareProfile}
        onVideoClick={handleVideoClick}
        onDisconnect={() => disconnect()}
        onConnectWallet={handleConnectWallet}
      />
      

      {/* Video Detail Modal */}
      {selectedVideo && (
        <VideoDetail
          videoUrl={selectedVideo.videoUrl}
          thumbnailUrl={selectedVideo.thumbnailUrl}
          username={displayUsername}
          description={profileData.bio || 'Check out this video!'}
          likes={(selectedVideo as any).likes || 0} // Use real likes from Lens data
          comments={(selectedVideo as any).comments || 0} // Use real comments from Lens data
          shares={(selectedVideo as any).shares || 0} // Use real shares from Lens data
          musicTitle="Original Sound"
          creatorHandle={profileData.displayName}
          creatorId={isLensProfile ? `lens/${profileIdentifier}` : undefined}
          lensPostId={isLensProfile ? selectedVideo.id : undefined} // Pass Lens post ID for reactions
          userHasLiked={false} // TODO: Get from Lens operations when available
          onClose={() => setSelectedVideo(null)}
          currentVideoIndex={currentVideoIndex}
          totalVideos={allVideos?.length || 0}
          onNavigatePrevious={handleNavigatePrevious}
          onNavigateNext={handleNavigateNext}
        />
      )}
    </>
  );
};