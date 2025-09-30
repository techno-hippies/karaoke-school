import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProfilePageView } from './ProfilePageView';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useEnsAddress, useDisconnect } from 'wagmi';
import { useProfileVideos, getCreatorHandle } from '../../hooks/media/useProfileVideos';
import { useLensProfileVideos } from '../../hooks/lens/useLensProfileVideos';
import { useLensAuth } from '../../hooks/lens/useLensAuth';
import { useLensFollows } from '../../hooks/lens/useLensFollows';

interface Video {
  id: string;
  thumbnailUrl: string;
  playCount: number;
  videoUrl?: string;
  likes?: number;
  comments?: number;
  shares?: number;
}

// For Lens profiles, we use native Lens follow protocol
// For regular profiles, we use ethereum-identity-kit for ENS/profile data

export const ProfilePage: React.FC = () => {
  const { addressOrEns, username } = useParams<{ addressOrEns?: string; username?: string }>();

  // Determine if this is a Lens profile and construct the identifier
  // Check if username param exists OR if addressOrEns is a known Lens account address
  const isLensAccountAddress = addressOrEns === '0xfe8374D7b392151deC051A9424bfa447700d6BB0'; // Your Lens account
  const isLensProfile = !!username || isLensAccountAddress;
  const profileIdentifier = isLensProfile ? (username || addressOrEns) : addressOrEns;


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
    connectedWalletAddress,
    isAuthenticated,
    isOwnProfile,
    authenticatedUser
  } = useLensAuth();
  const { openConnectModal } = useConnectModal();
  
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'following' | 'profile'>('profile');
  const [mobileTab, setMobileTab] = useState<'home' | 'post' | 'profile'>('profile');
  
  // Get final connected address from wallet
  // const finalConnectedAddress = connectedAddress;

  // Debug logging for authentication state
  React.useEffect(() => {
    console.log('[ProfilePage] Authentication state:', {
      isAuthenticated,
      connectedWalletAddress,
      displayAddress,
      displayConnected
    });
  }, [isAuthenticated, connectedWalletAddress, displayAddress, displayConnected]);
  
  // Check if viewing own profile using shared logic
  const isOwn = isOwnProfile(profileIdentifier);
  

  // Resolve ENS name to address if needed (only for non-Lens profiles)
  const { data: ensResolvedAddress } = useEnsAddress({
    name: !isLensProfile && profileIdentifier?.endsWith('.eth') ? profileIdentifier : undefined,
    chainId: 1, // mainnet
  });
  
  // Use resolved address: from ENS resolution or if already an address
  // For Lens profiles, we'll get the account address from their posts/profile data
  const profileAddress = isLensProfile
    ? undefined // Lens profiles use account addresses from their profile data
    : (ensResolvedAddress ||
       (profileIdentifier?.startsWith('0x') ? profileIdentifier : undefined) ||
       (profileIdentifier === 'vitalik.eth' ? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' : undefined));
  
  // Get Lens account address from their posts (if available)
  const [lensAccountAddress, setLensAccountAddress] = useState<string | undefined>(undefined);
  
  // Use Lens follows for Lens profiles
  const lensFollowHook = useLensFollows({
    targetAccountAddress: lensAccountAddress,
    initialFollowState: false
  });
  
  // For now, we'll use placeholder stats since we're not using ethereum-identity-kit
  const statsResult = { followers: 0, following: 0 };
  
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

  // Display username logic - abbreviate long addresses for both Lens and regular profiles
  const displayUsername = isLensProfile
    ? (profileIdentifier?.startsWith('0x') && profileIdentifier.length === 42
        ? `${profileIdentifier.slice(0, 6)}...${profileIdentifier.slice(-4)}`
        : profileIdentifier) // For Lens usernames, show directly
    : (creatorHandle || (profileIdentifier?.startsWith('0x')
        ? `${profileIdentifier.slice(0, 6)}...${profileIdentifier.slice(-4)}`
        : profileIdentifier || 'karaokeschool'));
  
  // Use real profile data from ethereum-identity-kit and fallback to defaults
  const profileData = useMemo(() => ({
    username: displayUsername,
    displayName: displayUsername, // Use username as display name
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileIdentifier}`, // Use avataaars for all profiles
    bio: isLensProfile
      ? '👋' // Simple waving emoji for Lens profiles
      : '', // Empty bio for non-Lens profiles
    // Check different possible locations for stats
    following: statsResult?.following || statsResult?.data?.following || 0,
    followers: statsResult?.followers || statsResult?.data?.followers || 0,
    isVerified: false, // This would come from your verification system
    isOwnProfile: isOwn,
    connectedAddress: connectedWalletAddress, // Pass connected address for follow button
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
    statsResult?.following,
    statsResult?.followers,
    statsResult?.data?.followers,
    statsResult?.data?.following,
    isOwn,
    connectedWalletAddress,
    allVideos,
    videosLoading
  ]);
  
  const handleDesktopTabChange = useCallback((tab: 'home' | 'discover' | 'following' | 'profile') => {
    if (tab === 'home') {
      navigate('/');
    } else if (tab === 'profile') {
      // Navigate to connected user's profile if clicking from another user's profile
      if (connectedWalletAddress && !isOwn) {
        const lensAccountAddress = authenticatedUser?.address;

        if (lensAccountAddress) {
          navigate(`/profile/${lensAccountAddress}`);
        } else {
          navigate(`/profile/${connectedWalletAddress}`);
        }
      }
    } else {
      setActiveTab(tab);
    }
  }, [navigate, connectedWalletAddress, isOwn, authenticatedUser]);

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
    console.log('[ProfilePage] Video clicked:', video);
    console.log('[ProfilePage] Navigating to video URL');

    // Navigate to individual video URL instead of modal
    if (isLensProfile) {
      if (username) {
        // True lens username case
        navigate(`/profile/lens/${username}/video/${video.id}`);
      } else {
        // Lens account address case - use addressOrEns route
        navigate(`/profile/${profileIdentifier}/video/${video.id}`);
      }
    } else {
      navigate(`/profile/${profileIdentifier}/video/${video.id}`);
    }
  }, [isLensProfile, username, profileIdentifier, navigate]);


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
        connectedAddress={connectedWalletAddress}
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
      

    </>
  );
};