import React, { useState, useEffect } from 'react';
import { Heart, ChatCircle, ShareFat, MusicNote, SpeakerHigh, SpeakerX, Plus, Play, Check } from '@phosphor-icons/react';
import { ActionButton } from './ActionButton';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { useVideoPlayer } from '../../hooks/media/useVideoPlayer';
import { useProfileNavigation } from '../../hooks/navigation/useProfileNavigation';
import { useTouchGestures } from '../../hooks/ui/useTouchGestures';
import { useLensReactions } from '../../hooks/lens/useLensReactions';
import { useLensFollows } from '../../hooks/lens/useLensFollows';
import { useKaraokeWords } from '../../hooks/karaoke/useKaraokeWords';
import { TikTokKaraokeRenderer } from '../karaoke/KaraokeWordsRenderer';

// Helper function to abbreviate wallet addresses
const abbreviateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Types for lyrics data
interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText?: string;
  start: number;
  end: number;
  wordCount: number;
  words?: WordTimestamp[];
}

interface LyricsData {
  lineTimestamps?: LineTimestamp[];  // Legacy format
  lines?: LineTimestamp[];           // Grove Storage format
  totalLines?: number;
  exportedAt?: string;
  format?: string;
}

interface KaraokeOverlayProps {
  lyricsUrl: string;
  segmentStart?: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
}

// Karaoke Overlay Component
const KaraokeOverlay: React.FC<KaraokeOverlayProps> = ({
  lyricsUrl,
  segmentStart,
  videoRef,
  isPlaying
}) => {
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Load lyrics data
  useEffect(() => {
    console.log('[KaraokeOverlay] Component mounted with:', { lyricsUrl, segmentStart });
    if (lyricsUrl) {
      console.log('[KaraokeOverlay] Loading lyrics from:', lyricsUrl);
      fetch(lyricsUrl)
        .then(response => response.json())
        .then((data: LyricsData) => {
          console.log('[KaraokeOverlay] Lyrics loaded:', data);
          setLyricsData(data);
        })
        .catch(error => {
          console.error('[KaraokeOverlay] Failed to load lyrics:', error);
        });
    } else {
      console.log('[KaraokeOverlay] No lyricsUrl provided - overlay will not render');
    }
  }, [lyricsUrl]);

  // Track video current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', updateTime);
    return () => video.removeEventListener('timeupdate', updateTime);
  }, [videoRef, isPlaying]);

  // Find current line to display
  const getCurrentLine = (): LineTimestamp | null => {
    if (!lyricsData || !segmentStart) return null;

    // Calculate the actual time in the song based on video position and segment start
    const songTime = segmentStart + currentTime;

    // Handle both formats: Grove Storage uses 'lines', legacy uses 'lineTimestamps'
    const lines = (lyricsData as any).lines || lyricsData.lineTimestamps || [];

    // Find the line that should be displayed at this time
    return lines.find((line: any) =>
      songTime >= line.start && songTime <= line.end
    ) || null;
  };

  const currentLine = getCurrentLine();

  // Get current words for karaoke highlighting
  const getCurrentWords = (): WordTimestamp[] => {
    if (!currentLine?.words || currentLine.words.length === 0) return [];
    return currentLine.words;
  };

  // Don't show overlay if no current line
  if (!currentLine) return null;

  const currentWords = getCurrentWords();
  const songTime = segmentStart ? segmentStart + currentTime : currentTime;

  return (
    <div className="absolute top-4 left-4 right-4 text-center pointer-events-none z-10">
      <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm shadow-lg">
        {currentWords.length > 0 ? (
          // Use karaoke word highlighting if word data is available
          <div className="text-lg font-semibold leading-tight mb-1">
            <TikTokKaraokeRenderer
              words={useKaraokeWords(currentWords, songTime)}
              className="flex flex-wrap justify-center"
            />
          </div>
        ) : (
          // Fallback to line-level display
          <div className="text-lg font-semibold leading-tight mb-1">
            {currentLine.originalText}
          </div>
        )}

        {currentLine.translatedText && (
          <div className="text-sm opacity-80 leading-tight">
            {currentLine.translatedText}
          </div>
        )}
      </div>
    </div>
  );
};

interface VideoPostFeedCoordinator {
  isActive: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  registerVideo: (element: HTMLElement | null) => void;
  unregisterVideo: () => void;
}

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
  creatorAccountAddress?: string;
  lensPostId?: string;
  userHasLiked?: boolean;
  videoId?: string;
  feedCoordinator?: VideoPostFeedCoordinator;
  // Karaoke props
  lyricsUrl?: string;
  lyricsFormat?: string;
  segmentStart?: number;
  segmentEnd?: number;
  songTitle?: string; // Song title for karaoke posts
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
  creatorId,
  creatorAccountAddress,
  lensPostId,
  userHasLiked,
  videoId,
  feedCoordinator,
  // Karaoke props
  lyricsUrl,
  lyricsFormat,
  segmentStart,
  segmentEnd,
  songTitle
}) => {
  // State
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isManuallyControlled, setIsManuallyControlled] = useState(false);

  // Get display values
  const displayUsername = abbreviateAddress(username);
  const displayMusicTitle = songTitle || musicTitle;

  // Custom hooks
  const {
    videoRef,
    isPlaying,
    isMuted,
    togglePlayPause,
    toggleMute,
    setMuted
  } = useVideoPlayer(videoUrl, {
    startMuted: true,
    autoplay: feedCoordinator?.isActive || false,
    username
  });

  // Register video with coordinator on mount only
  React.useEffect(() => {
    if (feedCoordinator && videoId) {
      const videoContainer = document.querySelector(`[data-video-id="${videoId}"]`) as HTMLElement;
      if (videoContainer) {
        feedCoordinator.registerVideo(videoContainer);
        return () => feedCoordinator.unregisterVideo();
      }
    }
  }, []); // Only run on mount/unmount

  // Track previous active state to detect when video becomes active for the first time
  const prevActiveRef = React.useRef(feedCoordinator?.isActive || false);

  // Handle coordinator-driven play/pause - only if not manually controlled
  React.useEffect(() => {
    if (!feedCoordinator || !videoRef.current || isManuallyControlled) return;

    const wasActive = prevActiveRef.current;
    const isNowActive = feedCoordinator.isActive;
    prevActiveRef.current = isNowActive;

    console.log(`[VideoPost ${username}] Coordinator state:`, {
      isActive: isNowActive,
      wasActive,
      isPlaying,
      videoId,
      isManuallyControlled
    });

    // Only autoplay when video BECOMES active (not when it's already active and paused manually)
    if (isNowActive && !wasActive) {
      // Video became active for the first time, try to autoplay and unmute
      console.log(`[VideoPost ${username}] Video became active - attempting autoplay with unmute`);
      if (isMuted) {
        setMuted(false);
      }
      videoRef.current.play().catch(e => console.log(`[VideoPost ${username}] Autoplay failed:`, e));
    } else if (!isNowActive && isPlaying) {
      // Video became inactive, pause
      console.log(`[VideoPost ${username}] Pausing inactive video`);
      videoRef.current.pause();
    }
  }, [feedCoordinator?.isActive, videoRef, username, videoId, isManuallyControlled, isMuted, setMuted]);

  // Notify coordinator of video events
  React.useEffect(() => {
    if (!feedCoordinator || !videoRef.current) return;

    const video = videoRef.current;
    const handlePlay = () => feedCoordinator.onPlay();
    const handlePause = () => feedCoordinator.onPause();
    const handleEnded = () => feedCoordinator.onEnded();

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [feedCoordinator, videoRef]);

  const { navigateToProfile } = useProfileNavigation();

  // Enhanced toggle function that sets manual control flag
  const handleTogglePlayPause = () => {
    console.log(`[VideoPost ${username}] Manual play/pause triggered - setting manual control`);
    setIsManuallyControlled(true);
    togglePlayPause();
    // Reset manual control after a longer delay to allow autoplay on scroll
    setTimeout(() => {
      console.log(`[VideoPost ${username}] Resetting manual control flag`);
      setIsManuallyControlled(false);
    }, 5000); // Increased to 5 seconds
  };

  const touchGestures = useTouchGestures({
    onTap: handleTogglePlayPause,
    // Note: Feed doesn't need swipe navigation like VideoDetail
  });

  // Lens reactions integration
  const {
    isLiked,
    likeCount,
    isLoading: isLikeLoading,
    toggleLike,
    canLike
  } = useLensReactions({
    postId: lensPostId || '',
    initialLikeCount: likes,
    userHasLiked
  });

  // Lens follows integration - use the account address for following
  const targetAccountAddress = creatorAccountAddress;

  const {
    isFollowing,
    isLoading: isFollowLoading,
    canFollow,
    toggleFollow
  } = useLensFollows({
    targetAccountAddress,
    initialFollowState: false
  });
  
  // Log props received by VideoPost for debugging
  React.useEffect(() => {
    console.log(`[VideoPost] Props for @${username}:`, {
      lensPostId: lensPostId?.slice(-8),
      userHasLiked,
      username,
      targetAccountAddress,
      canFollow,
      isFollowing,
      // Karaoke debug info
      lyricsUrl,
      lyricsFormat,
      segmentStart,
      segmentEnd,
      hasKaraokeData: !!lyricsUrl
    });
  }, [lensPostId, userHasLiked, username, targetAccountAddress, canFollow, isFollowing, lyricsUrl, lyricsFormat, segmentStart, segmentEnd]);

  return (
    <div
      className="relative h-screen w-full bg-black snap-start flex items-center justify-center"
      data-video-id={videoId || `${username}-${Date.now()}`}
    >
      {/* Video/Thumbnail Background - mobile: full screen, desktop: 9:16 centered */}
      <div
        className="relative w-full h-full md:w-[56vh] md:h-[90vh] md:max-w-[500px] md:max-h-[900px] bg-neutral-900 md:rounded-lg overflow-hidden cursor-pointer"
        onTouchStart={touchGestures.handleTouchStart}
        onTouchMove={touchGestures.handleTouchMove}
        onTouchEnd={touchGestures.handleTouchEnd}
        onClick={handleTogglePlayPause}
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
              <Play className="w-10 h-10 text-white fill-white ml-1" weight="fill" />
            </div>
          </div>
        )}

        {/* Karaoke Lyrics Overlay */}
        {lyricsUrl && (
          <KaraokeOverlay
            lyricsUrl={lyricsUrl}
            segmentStart={segmentStart}
            videoRef={videoRef}
            isPlaying={isPlaying}
          />
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
              <SpeakerX className="w-6 h-6 text-white drop-shadow-lg" />
            ) : (
              <SpeakerHigh className="w-6 h-6 text-white drop-shadow-lg" />
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
            @{displayUsername}
          </h3>
          <p className="text-white text-sm drop-shadow-lg line-clamp-2">{description}</p>
          <div className="flex items-center gap-2 mt-1">
            <MusicNote className="w-4 h-4 text-white drop-shadow-lg" />
            <span className="text-white text-sm drop-shadow-lg">{displayMusicTitle}</span>
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
                if (canFollow) {
                  console.log(`[Follow] ${isFollowing ? 'Unfollowing' : 'Following'} user: @${username}`);
                  toggleFollow();
                } else {
                  console.log(`[Follow] Cannot follow @${username} - missing auth or account address`);
                }
              }}
              disabled={!canFollow || isFollowLoading}
              className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
                isFollowing
                  ? 'bg-neutral-800 hover:bg-neutral-700'
                  : 'bg-[#FE2C55] hover:bg-[#FF0F3F]'
              } ${(!canFollow || isFollowLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isFollowLoading ? (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              ) : isFollowing ? (
                <Check className="w-4 h-4 text-red-500" />
              ) : (
                <Plus className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          {/* Like Button */}
          <ActionButton
            icon={Heart}
            count={likeCount}
            onClick={lensPostId ? toggleLike : () => console.log('[Like] No lens post ID')}
            isActive={isLiked}
            isLoading={isLikeLoading}
            disabled={lensPostId ? !canLike : false}
          />

          <ActionButton 
            icon={ChatCircle} 
            count={comments} 
            onClick={() => setCommentsOpen(true)}
          />

          <ActionButton
            icon={ShareFat}
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
            @{displayUsername}
          </h3>
          <p className="text-white text-sm mb-3">{description}</p>
          <div className="flex items-center gap-2">
            <MusicNote className="w-4 h-4 text-white" />
            <span className="text-white text-sm">{displayMusicTitle}</span>
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
              if (canFollow) {
                console.log(`[Follow] ${isFollowing ? 'Unfollowing' : 'Following'} user: @${username}`);
                toggleFollow();
              } else {
                console.log(`[Follow] Cannot follow @${username} - missing auth or account address`);
              }
            }}
            disabled={!canFollow || isFollowLoading}
            className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
              isFollowing
                ? 'bg-neutral-800 hover:bg-neutral-700'
                : 'bg-[#FE2C55] hover:bg-[#FE2C55]/80'
            } ${(!canFollow || isFollowLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isFollowLoading ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : isFollowing ? (
              <Check className="w-4 h-4 text-red-500" />
            ) : (
              <Plus className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Like Button */}
        <ActionButton
          icon={Heart}
          count={likeCount}
          onClick={lensPostId ? toggleLike : () => console.log('[Like] No lens post ID')}
          isActive={isLiked}
          isLoading={isLikeLoading}
          disabled={lensPostId ? !canLike : false}
        />

        {/* Comment Button */}
        <ActionButton 
          icon={ChatCircle} 
          count={comments} 
          onClick={() => setCommentsOpen(true)}
        />

        {/* Share Button */}
        <ActionButton
          icon={ShareFat}
          count={shares}
          onClick={() => setShareOpen(true)}
        />
      </div>
      
      {/* Sheets */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={lensPostId || ''} // Only pass valid Lens post IDs, empty string if none
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