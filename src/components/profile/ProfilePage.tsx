import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProfilePageView } from './ProfilePageView';
import { VideoDetail } from '../feed/VideoDetail';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { 
  useProfileDetails, 
  useProfileStats,
  listOpAddListRecord,
  listOpRemoveListRecord,
  formatListOpsTransaction,
  coreEfpContracts,
  ListRecordContracts
} from 'ethereum-identity-kit';
import { useAccount, useEnsAddress, useWriteContract, useReadContract, useDisconnect } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { useProfileVideos, getCreatorHandle } from '../../hooks/useProfileVideos';
import { useLensProfileVideos } from '../../hooks/useLensProfileVideos';
import { useDisplayAuth } from '../../hooks/useDisplayAuth';

interface Video {
  id: string;
  thumbnailUrl: string;
  playCount: number;
  videoUrl?: string;
}

// We'll use the EFP contracts from ethereum-identity-kit
// The SDK handles the correct contract addresses per chain

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
    pkpInfo,
    isOwnProfile
  } = useDisplayAuth();
  const { openConnectModal } = useConnectModal();
  const [pendingFollowAction, setPendingFollowAction] = useState<string | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  
  // For follow transactions
  const { writeContractAsync } = useWriteContract();
  
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'following' | 'profile'>('profile');
  const [mobileTab, setMobileTab] = useState<'home' | 'post' | 'profile'>('profile');
  
  // Get final connected address (PKP Viem account takes precedence for transactions)
  const finalConnectedAddress = pkpViemAccount?.address || connectedAddress;

  // Debug logging for authentication state differences
  React.useEffect(() => {
    console.log('[ProfilePage] Authentication state:', {
      isAuthenticated,
      hasInitialized,
      connectedWalletAddress,
      pkpInfo: pkpInfo ? 'present' : 'null',
      displayAddress,
      displayConnected
    });
  }, [isAuthenticated, hasInitialized, connectedWalletAddress, pkpInfo, displayAddress, displayConnected]);
  
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
  // For Lens profiles, we'll use the identifier as-is for now (could fetch Lens account address later)
  const profileAddress = isLensProfile
    ? undefined // Lens profiles don't have traditional addresses for EFP following
    : (ensResolvedAddress ||
       ens?.records?.['eth'] ||
       ens?.address ||
       (profileIdentifier?.startsWith('0x') ? profileIdentifier : undefined) ||
       (profileIdentifier === 'vitalik.eth' ? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' : undefined));
  
  // Initialize follow state from localStorage (immediate, no flicker)
  const getInitialFollowState = () => {
    if (typeof window === 'undefined') return false;
    if (connectedAddress && profileAddress) {
      const followKey = `follow:${connectedAddress.toLowerCase()}:${profileAddress.toLowerCase()}`;
      return localStorage.getItem(followKey) === 'true';
    }
    return false;
  };
  
  const [isFollowing, setIsFollowing] = useState(getInitialFollowState);
  
  // Query on-chain follow state for accuracy
  const { data: listOps } = useReadContract({
    address: '0x63B4e2Bb1E9b9D02AEF3Dc473c5B4b590219FA5e', // Base Sepolia ListRecords
    abi: [
      {
        inputs: [{ name: 'slot', type: 'uint256' }],
        name: 'getAllListOps',
        outputs: [{ name: '', type: 'bytes[]' }],
        stateMutability: 'view',
        type: 'function'
      }
    ] as const,
    functionName: 'getAllListOps',
    args: [0n], // Slot 0 for primary list
    enabled: !!connectedAddress && !!profileAddress,
    chainId: baseSepolia.id,
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
    
    if (isAuthenticated && profileAddress) {
      if (pkpViemAccount) {
        // We have a fresh PKP Viem account, execute follow
        setIsFollowLoading(true);
        try {
          // Toggle follow state
          const followOp = isFollowing 
            ? listOpRemoveListRecord(profileAddress)  // Unfollow
            : listOpAddListRecord(profileAddress);     // Follow
          
          // Use Base Sepolia testnet
          const chainId = 84532; // Base Sepolia
          // Base Sepolia EFP contracts (from official docs)
          const listRecordsAddress = '0x63B4e2Bb1E9b9D02AEF3Dc473c5B4b590219FA5e' as `0x${string}`;
          
          // Encode the follow operation properly
          // EFP operations are encoded as: version (1 byte) + opcode (1 byte) + data (address)
          const version = '01'; // version 1
          const opcode = isFollowing ? '02' : '01'; // opcode 2 for remove, 1 for add
          const addressWithoutPrefix = profileAddress.slice(2); // remove 0x
          const encodedOp = `0x${version}${opcode}${addressWithoutPrefix}` as `0x${string}`;
          
          // Execute the transaction directly to the ListRecords contract
          const hash = await writeContractAsync({
            address: listRecordsAddress,
            abi: [
              {
                inputs: [
                  { name: 'slot', type: 'uint256' },
                  { name: 'op', type: 'bytes' }
                ],
                name: 'applyListOp',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function'
              }
            ],
            functionName: 'applyListOp',
            args: [0n, encodedOp], // slot 0 for primary list, properly encoded op
            account: pkpViemAccount,
            chain: baseSepolia // Use Base Sepolia testnet
          });
          
          console.log(`[ProfilePage] ${isFollowing ? 'Unfollow' : 'Follow'} transaction sent:`, hash);
          
          // Update state optimistically
          setIsFollowing(!isFollowing);
        } catch (error) {
          console.error('[ProfilePage] Follow transaction failed:', error);
        } finally {
          setIsFollowLoading(false);
        }
      } else {
        // Need fresh auth to get PKP Viem account - show modal
        setPendingFollowAction(profileAddress);
        openConnectModal?.();
        // After auth completes, the effect below will execute the follow
      }
    } else {
      // Not authenticated, show auth modal
      openConnectModal?.();
    }
  };
  
  // Execute pending follow after getting fresh PKP Viem account
  useEffect(() => {
    if (pendingFollowAction && pkpViemAccount) {
      setPendingFollowAction(null);
      // Trigger the follow
      handleConnectWallet();
    }
  }, [pkpViemAccount, pendingFollowAction]);
  
  // Process on-chain ops to check follow state
  useEffect(() => {
    if (listOps && listOps.length > 0 && profileAddress) {
      // Parse ops to check if following
      // Each op is encoded as: version (1 byte) + opcode (1 byte) + data (address)
      let isCurrentlyFollowing = false;
      
      for (const op of listOps) {
        if (typeof op === 'string' && op.startsWith('0x')) {
          const opcode = op.slice(4, 6); // Skip 0x and version byte, get opcode
          const targetAddress = '0x' + op.slice(6); // Rest is the address
          
          if (targetAddress.toLowerCase() === profileAddress.toLowerCase()) {
            if (opcode === '01') {
              // Follow op
              isCurrentlyFollowing = true;
            } else if (opcode === '02') {
              // Unfollow op (later in list, overrides follow)
              isCurrentlyFollowing = false;
            }
          }
        }
      }
      
      setIsFollowing(isCurrentlyFollowing);
      
      // Update localStorage for offline fallback
      const followKey = `follow:${connectedAddress.toLowerCase()}:${profileAddress.toLowerCase()}`;
      localStorage.setItem(followKey, isCurrentlyFollowing.toString());
    }
  }, [listOps, profileAddress, connectedAddress]);
  
  // Store follow state after transaction (optimistic update)
  useEffect(() => {
    if (connectedAddress && profileAddress && !isFollowLoading) {
      const followKey = `follow:${connectedAddress.toLowerCase()}:${profileAddress.toLowerCase()}`;
      localStorage.setItem(followKey, isFollowing.toString());
    }
  }, [isFollowing, isFollowLoading, connectedAddress, profileAddress]);

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