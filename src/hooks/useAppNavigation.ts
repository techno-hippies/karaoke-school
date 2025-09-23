import { useNavigate } from 'react-router-dom';
import { useDisplayAuth } from './useDisplayAuth';

/**
 * Shared navigation logic for the app
 * Handles auth-required navigation, profile paths, and tab changes
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const { connectedAddress } = useDisplayAuth();

  /**
   * Navigate to user's own profile if authenticated, otherwise show auth modal
   */
  const navigateToOwnProfile = (onShowAuthModal?: () => void) => {
    if (connectedAddress) {
      navigate(`/profile/${connectedAddress}`);
    } else if (onShowAuthModal) {
      onShowAuthModal();
    }
  };

  /**
   * Navigate to a specific profile (Lens or regular)
   */
  const navigateToProfile = (identifier: string, isLensProfile: boolean = false) => {
    const profilePath = isLensProfile
      ? `/profile/lens/${identifier}`
      : `/profile/${identifier}`;
    navigate(profilePath);
  };

  /**
   * Navigate to a specific video within a profile context
   */
  const navigateToProfileVideo = (
    profileIdentifier: string,
    videoId: string,
    isLensProfile: boolean = false
  ) => {
    const profilePath = isLensProfile
      ? `/profile/lens/${profileIdentifier}`
      : `/profile/${profileIdentifier}`;
    navigate(`${profilePath}/video/${videoId}`);
  };

  /**
   * Handle desktop tab navigation with auth checks
   */
  const handleDesktopTabChange = (
    tab: 'home' | 'discover' | 'following' | 'profile',
    activeTab: string,
    setActiveTab: (tab: any) => void,
    onShowAuthModal?: () => void
  ) => {
    if (tab === 'home') {
      navigate('/');
    } else if (tab === 'profile') {
      navigateToOwnProfile(onShowAuthModal);
    } else {
      setActiveTab(tab);
    }
  };

  /**
   * Handle mobile tab navigation with auth checks
   */
  const handleMobileTabChange = (
    tab: 'home' | 'post' | 'profile',
    setMobileTab: (tab: any) => void,
    setActiveTab: (tab: any) => void,
    onShowAuthModal?: () => void,
    onCreatePost?: () => void
  ) => {
    if (tab === 'home') {
      navigate('/');
    } else if (tab === 'post') {
      if (onCreatePost) {
        onCreatePost();
      } else {
        console.log('Create post');
      }
      return;
    } else if (tab === 'profile') {
      navigateToOwnProfile(onShowAuthModal);
    } else {
      setMobileTab(tab);
      setActiveTab(tab as any);
    }
  };

  /**
   * Share a profile with native share API or clipboard fallback
   */
  const shareProfile = async (
    profileIdentifier: string,
    bio: string,
    isLensProfile: boolean = false
  ) => {
    const profilePath = isLensProfile
      ? `/profile/lens/${profileIdentifier}`
      : `/profile/${profileIdentifier}`;
    const shareUrl = `${window.location.origin}/#${profilePath}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Profile on TikTok`,
          text: bio || 'Check out this profile',
          url: shareUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      console.log('Link copied to clipboard');
    }
  };

  return {
    navigate,
    navigateToOwnProfile,
    navigateToProfile,
    navigateToProfileVideo,
    handleDesktopTabChange,
    handleMobileTabChange,
    shareProfile
  };
}