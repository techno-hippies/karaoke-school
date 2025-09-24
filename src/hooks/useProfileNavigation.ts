import { useNavigate } from 'react-router-dom';

interface UseProfileNavigationReturn {
  getProfileRoute: (username: string, creatorHandle?: string, creatorId?: string) => string;
  navigateToProfile: (username: string, creatorHandle?: string, creatorId?: string) => void;
}

/**
 * Hook for handling profile navigation logic consistently across components.
 * Eliminates duplicated profile route determination logic.
 */
export const useProfileNavigation = (): UseProfileNavigationReturn => {
  const navigate = useNavigate();

  const getProfileRoute = (username: string, creatorHandle?: string, creatorId?: string): string => {
    // Priority: creatorId (handle) > creatorHandle > username
    const profileId = creatorId || creatorHandle || username;
    const cleanId = profileId.replace('@', '');

    // Check if this is a Lens handle
    if (cleanId.startsWith('lens/') || cleanId.includes('lens/')) {
      const lensUsername = cleanId.replace('lens/', '');
      console.log('[useProfileNavigation] Building Lens profile route:', {
        profileId,
        cleanId,
        lensUsername,
        finalRoute: `/profile/lens/${lensUsername}`
      });
      return `/profile/lens/${lensUsername}`;
    } else {
      console.log('[useProfileNavigation] Building regular profile route:', {
        profileId,
        cleanId,
        finalRoute: `/profile/${cleanId}`
      });
      return `/profile/${cleanId}`;
    }
  };

  const navigateToProfile = (username: string, creatorHandle?: string, creatorId?: string): void => {
    const profileRoute = getProfileRoute(username, creatorHandle, creatorId);
    console.log(`[useProfileNavigation] Navigating to: ${profileRoute}`);
    try {
      navigate(profileRoute);
      console.log(`[useProfileNavigation] Navigation successful`);
    } catch (error) {
      console.error(`[useProfileNavigation] Navigation failed:`, error);
    }
  };

  return {
    getProfileRoute,
    navigateToProfile,
  };
};