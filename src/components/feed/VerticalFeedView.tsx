import React, { useRef } from 'react';
import { VideoPost } from './VideoPost';
import { VideoQuizPost } from './VideoQuizPost';
import { MobileFooter } from '../navigation/MobileFooter';
import { DesktopSidebar } from '../navigation/DesktopSidebar';
import { Button } from '../ui/button';

interface FeedItem {
  id: string;
  type: 'video' | 'quiz';
  data: any;
}

interface VerticalFeedViewProps {
  feedItems: FeedItem[];
  activeTab: 'home' | 'discover' | 'following' | 'profile';
  mobileTab: 'home' | 'post' | 'profile';
  isConnected: boolean;
  walletAddress?: string;
  
  onDesktopTabChange: (tab: 'home' | 'discover' | 'following' | 'profile') => void;
  onMobileTabChange: (tab: 'home' | 'post' | 'profile') => void;
  onCreatePost: () => void;
  onDisconnect: () => void;
  onOnboardingAction: (type: string) => void;
  
  // Optional coordinator for XState integration
  feedCoordinator?: {
    activeVideoId: string | null;
    handleVideoPlay: (videoId: string) => void;
    handleVideoPause: (videoId: string) => void;
    registerVideo: (videoId: string, element: HTMLElement | null) => void;
    isVideoActive: (videoId: string) => boolean;
    getVideoState: (videoId: string) => 'idle' | 'playing' | 'paused';
  };
}

/**
 * Pure UI component for VerticalFeed
 * No hooks, no wagmi dependencies
 */
export const VerticalFeedView: React.FC<VerticalFeedViewProps> = ({
  feedItems,
  activeTab,
  mobileTab,
  isConnected,
  walletAddress,
  onDesktopTabChange,
  onMobileTabChange,
  onCreatePost,
  onDisconnect,
  onOnboardingAction,
  feedCoordinator,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (activeTab === 'discover') {
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar 
          activeTab={activeTab}
          onTabChange={onDesktopTabChange}
          onCreatePost={onCreatePost}
          isConnected={isConnected}
          walletAddress={walletAddress}
          onDisconnect={onDisconnect}
          onConnectWallet={() => onOnboardingAction('connect')}
        />
        <div className="flex-1 flex items-center justify-center text-white md:ml-20 lg:ml-64">
          <div className="text-center">
            <h2 className="text-2xl mb-4">Discover</h2>
            <p className="text-neutral-400">Explore trending content</p>
          </div>
        </div>
        <MobileFooter activeTab={mobileTab} onTabChange={onMobileTabChange} />
      </div>
    );
  }

  if (activeTab === 'following') {
    return (
      <div className="h-screen bg-black flex">
        <DesktopSidebar 
          activeTab={activeTab}
          onTabChange={onDesktopTabChange}
          onCreatePost={onCreatePost}
          isConnected={isConnected}
          walletAddress={walletAddress}
          onDisconnect={onDisconnect}
          onConnectWallet={() => onOnboardingAction('connect')}
        />
        <div className="flex-1 flex items-center justify-center text-white md:ml-20 lg:ml-64">
          <div className="text-center">
            <h2 className="text-2xl mb-4">Following</h2>
            <p className="text-neutral-400">Content from creators you follow</p>
          </div>
        </div>
        <MobileFooter activeTab={mobileTab} onTabChange={onMobileTabChange} />
      </div>
    );
  }

  // Main feed view
  return (
    <div className="h-screen bg-black flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar 
        activeTab={activeTab as any}
        onTabChange={onDesktopTabChange}
        onCreatePost={onCreatePost}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onDisconnect={onDisconnect}
        onConnectWallet={() => onOnboardingAction('connect')}
      />
      
      {/* Feed Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 h-screen overflow-y-scroll snap-y snap-mandatory md:ml-20 lg:ml-64"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {feedItems && Array.isArray(feedItems) && feedItems.length > 0 ? (
          feedItems.map((item) => {
            // console.log(`[VerticalFeedView] Rendering item:`, item);

            if (item.type === 'video') {
            // Use standard VideoPost for all videos (tracking disabled for now)
            const Component = VideoPost;

            // console.log(`[VerticalFeedView] Rendering VideoPost with data:`, item.data);

            return (
              <Component
                key={item.id}
                {...item.data}
                // Pass coordinator if available
                isActive={feedCoordinator?.isVideoActive(item.id) || false}
                onPlay={feedCoordinator ? () => feedCoordinator.handleVideoPlay(item.id) : undefined}
                onPause={feedCoordinator ? () => feedCoordinator.handleVideoPause(item.id) : undefined}
                registerRef={feedCoordinator ? (el) => feedCoordinator.registerVideo(item.id, el) : undefined}
              />
            );
          }
          
          if (item.type === 'quiz') {
            return (
              <VideoQuizPost
                key={item.id}
                {...item.data}
                onQuizAnswer={(selectedId, isCorrect) => {
                  console.log(`Quiz answered: ${selectedId}, correct: ${isCorrect}`);
                }}
              />
            );
          }
          
          return null;
        })
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <p>Loading...</p>
          </div>
        )}
      </div>
      
      {/* Mobile Footer */}
      <MobileFooter activeTab={mobileTab} onTabChange={onMobileTabChange} />
    </div>
  );
};