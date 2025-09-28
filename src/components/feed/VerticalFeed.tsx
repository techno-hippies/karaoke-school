import React, { useState, useEffect } from 'react';
import { useDisconnect } from 'wagmi';
import { VerticalFeedView } from './VerticalFeedView';
import { useQuery } from '@tanstack/react-query';
import { getAppFeedItems } from '../../lib/feed';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisplayAuth } from '../../hooks/useDisplayAuth';
import type { FeedItem } from '../../types/feed';
import {
  transformLensFeed
} from '../../utils/feedTransforms';
import { useAppNavigation } from '../../hooks/useAppNavigation';

/**
 * Container component with business logic
 * Uses wagmi hooks and passes data to VerticalFeedView
 */
export const VerticalFeed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'profile'>('home');
  const [mobileTab, setMobileTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('home');
  const { openConnectModal } = useConnectModal();
  
  // Wallet integration
  const { disconnect } = useDisconnect();

  // Shared authentication logic
  const {
    displayAddress,
    displayConnected,
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
  

  // Fetch app feed items directly using appId filter
  const appFeedQuery = useQuery({
    queryKey: ['app-feed'],
    queryFn: getAppFeedItems,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  const blockchainFeed = appFeedQuery.data;
  
  // Debug app accounts
  // React.useEffect(() => {
  //   if (pkpMappingsQuery.data) {
  //     console.log('[VerticalFeed] App accounts:', pkpMappingsQuery.data);
  //     if (pkpMappingsQuery.data.length > 0) {
  //       console.log('[VerticalFeed] First account:', pkpMappingsQuery.data[0]);
  //     }
  //   }
  // }, [pkpMappingsQuery.data]);



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


  // Handle desktop tab changes using the navigation hook
  const handleDesktopTabChange = (tab: 'home' | 'study' | 'profile') => {
    navigation.handleDesktopTabChange(
      tab,
      activeTab,
      setActiveTab,
      () => openConnectModal?.()
    );
  };

  // Handle mobile tab changes using the navigation hook
  const handleMobileTabChange = (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => {
    console.log('[VerticalFeed] Mobile tab change:', tab);
    navigation.handleMobileTabChange(
      tab,
      setMobileTab,
      setActiveTab,
      () => openConnectModal?.(),
      handleCreatePost
    );
  };

  const handleCreatePost = () => {
    console.log('Create post clicked');
  };

  // Use the view component for rendering
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
      />
    </>
  );
};