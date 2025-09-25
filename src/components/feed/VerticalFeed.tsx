import React, { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { VerticalFeedView } from './VerticalFeedView';
import { FeedXState } from './FeedXState';
import { useSubgraphFeed } from '../../hooks/useSubgraphFeed';
import { usePKPLensFeed, usePKPLensMapping } from '../../lib/pkp-lens-mapping';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useFeedCoordinator } from '../../hooks/useFeedCoordinator';
import { useDisplayAuth } from '../../hooks/useDisplayAuth';
import type { FeedItem } from '../../types/feed';
import {
  transformLensFeed,
  createSampleQuiz
} from '../../utils/feedTransforms';
import { useAppNavigation } from '../../hooks/useAppNavigation';

/**
 * Container component with business logic
 * Uses wagmi hooks and passes data to VerticalFeedView
 */
export const VerticalFeed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'following' | 'profile'>('home');
  const [mobileTab, setMobileTab] = useState<'home' | 'post' | 'profile'>('home');
  const [tiktokLinked, setTiktokLinked] = useState(false);
  const [videosMinted, setVideosMinted] = useState(false);
  const { openConnectModal } = useConnectModal();
  
  // Wallet integration
  const { disconnect } = useDisconnect();

  // Shared authentication logic
  const {
    displayAddress,
    displayConnected,
    connectedAddress,
    isAuthenticated
  } = useDisplayAuth();

  // Shared navigation logic
  const navigation = useAppNavigation();
  
  // Debug logging for authentication state
  useEffect(() => {
    console.log('[VerticalFeed] Authentication state:', {
      isAuthenticated,
      hasInitialized: true,
      displayAddress,
      displayConnected
    });
  }, [isAuthenticated, displayAddress, displayConnected]);
  
  // Remove the auto-close effect entirely - let the modal handle it
  
  const navigate = useNavigate();

  // Fetch PKP mappings and their Lens posts
  const pkpMappingsQuery = usePKPLensMapping();
  const pkpFeedQuery = usePKPLensFeed();
  
  // Use ONLY PKP feed - no fallback to general feed ever
  const blockchainFeed = pkpFeedQuery.data;
  const isLoading = pkpFeedQuery.isLoading;
  const error = pkpFeedQuery.error;
  
  // Debug app accounts
  // React.useEffect(() => {
  //   if (pkpMappingsQuery.data) {
  //     console.log('[VerticalFeed] App accounts:', pkpMappingsQuery.data);
  //     if (pkpMappingsQuery.data.length > 0) {
  //       console.log('[VerticalFeed] First account:', pkpMappingsQuery.data[0]);
  //     }
  //   }
  // }, [pkpMappingsQuery.data]);

  // Keep one sample quiz for demo purposes
  const sampleQuiz = createSampleQuiz();


  // Get feed from Lens Protocol and transform to FeedItem format - LIMITED TO 3 FOR DEBUGGING
  const getFilteredFeed = (): FeedItem[] => {
    return transformLensFeed(blockchainFeed, 3);
  };

  const handleOnboardingAction = (type: string) => {
    if (type === 'connect' || type === 'wallet') {
      // Show RainbowKit connect modal
      openConnectModal?.();
    }
    
    if (type === 'tiktok') {
      // This would trigger Camp modal for TikTok linking
      setTiktokLinked(true);
    }
    
    if (type === 'mint') {
      // This would trigger minting process
      setVideosMinted(true);
    }
  };

  const filteredFeed = getFilteredFeed();

  // Debug the final feed that will be passed to VerticalFeedView
  // React.useEffect(() => {
  //   console.log('[VerticalFeed] Final filtered feed being passed to VerticalFeedView:', filteredFeed);
  //   if (filteredFeed.length > 0) {
  //     console.log('[VerticalFeed] First feed item structure:', filteredFeed[0]);
  //     console.log('[VerticalFeed] First feed item data:', filteredFeed[0].data);
  //   }
  // }, [filteredFeed]);

  // Use XState for video playback coordination only
  const feedCoordinator = useFeedCoordinator(filteredFeed);

  // Handle desktop tab changes
  const handleDesktopTabChange = (tab: 'home' | 'discover' | 'following' | 'profile') => {
    if (tab === 'profile') {
      if (connectedAddress) {
        // Navigate to connected wallet's profile or PKP address
        navigate(`/profile/${connectedAddress}`);
      } else {
        // Show RainbowKit connect modal if not connected
        openConnectModal?.();
      }
    } else {
      setActiveTab(tab);
    }
  };

  // Handle mobile tab changes
  const handleMobileTabChange = (tab: 'home' | 'post' | 'profile') => {
    if (tab === 'post') {
      console.log('Create post');
      return;
    }
    if (tab === 'profile') {
      if (connectedAddress) {
        // Navigate to connected wallet's profile or PKP address
        navigate(`/profile/${connectedAddress}`);
      } else {
        // Show RainbowKit connect modal if not connected
        openConnectModal?.();
      }
    } else {
      setMobileTab(tab);
      setActiveTab(tab as any);
    }
  };

  const handleCreatePost = () => {
    console.log('Create post clicked');
  };

  // Feature flag to switch between old and new implementation
  const USE_XSTATE = false; // Set to false to use old implementation with full UI

  // Use XState implementation if flag is enabled
  if (USE_XSTATE) {
    return <FeedXState />;
  }

  // Use the view component for rendering with XState coordination
  // Authentication display values come from useDisplayAuth hook

  // console.log('[VerticalFeed] Display state:', {
  //   displayConnected,
  //   displayAddress,
  //   litAuthenticated
  // });
  
  return (
    <>
      <VerticalFeedView
        feedItems={filteredFeed}
        activeTab={activeTab}
        mobileTab={mobileTab}
        isConnected={displayConnected}
        walletAddress={displayAddress}
        onDesktopTabChange={handleDesktopTabChange}
        onMobileTabChange={handleMobileTabChange}
        onCreatePost={handleCreatePost}
        onDisconnect={() => disconnect()}
        onOnboardingAction={handleOnboardingAction}
        // Pass coordinator functions for video state management
        feedCoordinator={feedCoordinator}
      />
    </>
  );
};