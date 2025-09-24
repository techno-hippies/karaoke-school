import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Music, Volume2, VolumeX, Plus, Play } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useProfileNavigation } from '../../hooks/useProfileNavigation';
import { useTouchGestures } from '../../hooks/useTouchGestures';

interface VideoPostProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  username: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  musicTitle?: string;
  creatorHandle?: string;
  creatorId?: string;
  pkpPublicKey?: string;
}

export const VideoPost: React.FC<VideoPostProps> = ({
  videoUrl,
  thumbnailUrl,
  username,
  description,
  likes,
  comments,
  shares,
  musicTitle = 'Original Sound',
  creatorHandle,
  creatorId
}) => {
  // State
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Custom hooks
  const {
    videoRef,
    isPlaying,
    isMuted,
    togglePlayPause,
    toggleMute
  } = useVideoPlayer(videoUrl, {
    startMuted: true,
    autoplay: false,
    username
  });

  const { navigateToProfile } = useProfileNavigation();

  const touchGestures = useTouchGestures({
    onTap: togglePlayPause,
    // Note: Feed doesn't need swipe navigation like VideoDetail
  });
  
  // Log props received by VideoPost for debugging
  React.useEffect(() => {
    // console.log(`[VideoPost] Component props for @${username}:`, { username, creatorHandle, creatorId });
  }, [videoUrl, username, description]);

  return (
    <div className="relative h-screen w-full bg-black snap-start flex items-center justify-center">
      {/* Video/Thumbnail Background - mobile: full screen, desktop: 9:16 centered */}
      <div
        className="relative w-full h-full md:w-[56vh] md:h-[90vh] md:max-w-[500px] md:max-h-[900px] bg-neutral-900 md:rounded-lg overflow-hidden cursor-pointer"
        onTouchStart={touchGestures.handleTouchStart}
        onTouchMove={touchGestures.handleTouchMove}
        onTouchEnd={touchGestures.handleTouchEnd}
        onClick={togglePlayPause}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            loop
            muted={isMuted}
            playsInline
            poster={thumbnailUrl}
            onPlay={() => {}} // Handled by useVideoPlayer hook
            onPause={() => {}} // Handled by useVideoPlayer hook
            onEnded={() => {}} // Handled by useVideoPlayer hook
          />
        ) : thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={description}
            className="w-full h-full object-cover"
          />
        ) : null}

        {/* Play/Pause Overlay - only show when paused */}
        {videoUrl && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-200">
            <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Mute/Unmute button - top left of video */}
        {videoUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering play/pause
              toggleMute();
            }}
            className="absolute top-4 left-4 p-2 z-10"
          >
            {isMuted ? (
              <VolumeX className="w-6 h-6 text-white drop-shadow-lg" />
            ) : (
              <Volume2 className="w-6 h-6 text-white drop-shadow-lg" />
            )}
          </button>
        )}
        
        {/* Desktop: Video info at bottom of video - INSIDE video bounds */}
        <div className="max-md:hidden absolute bottom-4 left-4 right-4 z-20">
          <h3
            className="text-white font-semibold text-base drop-shadow-lg cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigateToProfile(username, creatorHandle, creatorId);
            }}
          >
            @{username}
          </h3>
          <p className="text-white text-sm drop-shadow-lg line-clamp-2">{description}</p>
          <div className="flex items-center gap-2 mt-1">
            <Music className="w-4 h-4 text-white drop-shadow-lg" />
            <span className="text-white text-sm drop-shadow-lg">{musicTitle}</span>
          </div>
        </div>
      </div>

      {/* Mobile: Right side actions and bottom info - only show on mobile */}
      <div className="md:hidden">
        {/* Mobile Right side actions */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6">
          {/* Profile Avatar with Follow Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateToProfile(username, creatorHandle, creatorId);
              }}
              className="w-12 h-12 rounded-full bg-neutral-300 overflow-hidden cursor-pointer"
            >
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                alt={username}
                className="w-full h-full object-cover"
              />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                console.log(`[Follow] Following user: @${username}`);
                // TODO: Implement follow functionality
              }}
              className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-[#FE2C55] hover:bg-[#FF0F3F] rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Like Button */}
          <ActionButton 
            icon={Heart} 
            count={likes} 
            onClick={() => console.log('[Like] Liked video')}
          />

          <ActionButton 
            icon={MessageCircle} 
            count={comments} 
            onClick={() => setCommentsOpen(true)}
          />

          <ActionButton 
            icon={Share2} 
            count={shares} 
            onClick={() => setShareOpen(true)}
          />
        </div>

        {/* Mobile Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 pr-20 bg-gradient-to-t from-black/80 to-transparent">
          <h3
            className="text-white font-semibold mb-2 cursor-pointer active:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigateToProfile(username, creatorHandle, creatorId);
            }}
          >
            @{username}
          </h3>
          <p className="text-white text-sm mb-3">{description}</p>
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-white" />
            <span className="text-white text-sm">{musicTitle}</span>
          </div>
        </div>
      </div>

      {/* Desktop: Action buttons to the right */}
      <div className="max-md:hidden flex absolute left-[calc(50%+28vh+20px)] top-1/2 transform -translate-y-1/2 flex-col items-center gap-4">
        {/* Profile Avatar with Follow Button */}
        <div className="relative mb-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateToProfile(username, creatorHandle, creatorId);
            }}
            className="w-12 h-12 rounded-full bg-neutral-300 overflow-hidden cursor-pointer"
          >
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
              alt={username}
              className="w-full h-full object-cover"
            />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log(`[Follow] Following user: @${username}`);
              // TODO: Implement follow functionality
            }}
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-[#FE2C55] hover:bg-[#FE2C55]/80 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Like Button */}
        <ActionButton 
          icon={Heart} 
          count={likes} 
          onClick={() => console.log('[Like] Liked video')}
        />

        {/* Comment Button */}
        <ActionButton 
          icon={MessageCircle} 
          count={comments} 
          onClick={() => setCommentsOpen(true)}
        />

        {/* Share Button */}
        <ActionButton 
          icon={Share2} 
          count={shares} 
          onClick={() => setShareOpen(true)}
        />
      </div>
      
      {/* Sheets */}
      <CommentsSheet 
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={username}
      />
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        postUrl={`https://karaokeschool.com/@${username}`}
        postDescription={description}
      />
    </div>
  );
};