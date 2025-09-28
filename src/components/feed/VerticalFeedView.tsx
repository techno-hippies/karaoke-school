import React, { useRef, useEffect } from 'react';
import { useMachine } from '@xstate/react';
import { VideoPost } from './VideoPost';
import { VideoQuizPost } from './VideoQuizPost';
import { MobileFooter } from '../navigation/MobileFooter';
import { DesktopSidebar } from '../navigation/DesktopSidebar';
import { FeedSkeleton } from './FeedSkeleton';
import { useVideoFeedManager } from '../../hooks/feed/useVideoFeedManager';
import { feedCoordinatorMachine } from '../../machines/feedCoordinatorMachine';

interface FeedItem {
  id: string;
  type: 'video' | 'quiz';
  data: {
    videoUrl: string;
    username: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
    [key: string]: unknown;
  };
}

interface VerticalFeedViewProps {
  feedItems: FeedItem[];
  activeTab: 'home' | 'study' | 'profile';
  mobileTab: 'home' | 'study' | 'post' | 'inbox' | 'profile';
  isConnected: boolean;
  walletAddress?: string;

  onDesktopTabChange: (tab: 'home' | 'study' | 'profile') => void;
  onMobileTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void;
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
  feedCoordinator: _feedCoordinator,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize feed coordinator machine
  const [coordinatorState, coordinatorSend] = useMachine(feedCoordinatorMachine);

  // Initialize video feed manager with Intersection Observer
  const { activeVideoId, registerVideo, unregisterVideo, setContainerRef } = useVideoFeedManager({
    threshold: 0.5, // Lower threshold for more sensitive detection
    autoplay: true
  });

  // Connect scroll container to feed manager
  useEffect(() => {
    setContainerRef(scrollContainerRef.current);
  }, [setContainerRef]);


  // Sync active video changes with coordinator machine
  useEffect(() => {
    if (activeVideoId) {
      coordinatorSend({ type: 'VIDEO_BECAME_ACTIVE', videoId: activeVideoId });
    } else {
      coordinatorSend({ type: 'VIDEO_BECAME_INACTIVE', videoId: coordinatorState.context.activeVideoId || '' });
    }
  }, [activeVideoId, coordinatorSend, coordinatorState.context.activeVideoId]);

  // Learn tab is now handled by the router - this component only shows the main feed

  // Main feed view
  return (
    <div className="h-screen bg-neutral-900 flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar 
        activeTab={activeTab as 'home' | 'study' | 'profile'}
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
            // Use standard VideoPost for all videos with new coordinator
            const Component = VideoPost;

            // Create simple coordinator interface
            const videoCoordinator = {
              isActive: activeVideoId === item.id,
              onPlay: () => coordinatorSend({ type: 'VIDEO_PLAYED', videoId: item.id }),
              onPause: () => coordinatorSend({ type: 'VIDEO_PAUSED', videoId: item.id }),
              onEnded: () => coordinatorSend({ type: 'VIDEO_ENDED', videoId: item.id }),
              registerVideo: (element: HTMLElement | null) => {
                coordinatorSend({ type: 'REGISTER_VIDEO', videoId: item.id, element });
                registerVideo(item.id, element);
              },
              unregisterVideo: () => {
                coordinatorSend({ type: 'UNREGISTER_VIDEO', videoId: item.id });
                unregisterVideo(item.id);
              }
            };

            return (
              <Component
                key={item.id}
                {...item.data}
                // Pass video ID and coordinator interface
                videoId={item.id}
                feedCoordinator={videoCoordinator}
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
          <FeedSkeleton count={3} />
        )}
      </div>
      
      {/* Mobile Footer */}
      <MobileFooter activeTab={mobileTab} onTabChange={onMobileTabChange} />
    </div>
  );
};