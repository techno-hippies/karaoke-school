import React, { useState, useRef, useEffect } from 'react';
import { Heart, ChatCircle, ShareNetwork, MusicNote, SpeakerHigh, SpeakerX, X, CaretUp, CaretDown, Play } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from './ActionButton';
import { CommentsSheet } from './CommentsSheet';
import type { CommentsSheetProps } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { Comment } from './Comment';
import { CommentInput } from './CommentInput';
import { VideoPost } from './VideoPost';
import { useKaraokeWords } from '../../hooks/karaoke/useKaraokeWords';
import { TikTokKaraokeRenderer } from '../karaoke/KaraokeWordsRenderer';
import Hls from 'hls.js';

// Types for lyrics data (same as VideoPost)
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

// Karaoke Overlay Component (same as VideoPost)
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
    console.log('[VideoDetail KaraokeOverlay] Component mounted with:', { lyricsUrl, segmentStart });
    if (lyricsUrl) {
      console.log('[VideoDetail KaraokeOverlay] Loading lyrics from:', lyricsUrl);
      fetch(lyricsUrl)
        .then(response => response.json())
        .then((data: LyricsData) => {
          console.log('[VideoDetail KaraokeOverlay] Lyrics loaded:', data);
          setLyricsData(data);
        })
        .catch(error => {
          console.error('[VideoDetail KaraokeOverlay] Failed to load lyrics:', error);
        });
    } else {
      console.log('[VideoDetail KaraokeOverlay] No lyricsUrl provided - overlay will not render');
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

export interface VideoDetailProps {
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
  lensPostId?: string;
  userHasLiked?: boolean;
  onClose?: () => void;
  // Navigation props
  currentVideoIndex?: number;
  totalVideos?: number;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  // Karaoke props
  lyricsUrl?: string;
  lyricsFormat?: string;
  segmentStart?: number;
  segmentEnd?: number;
  songTitle?: string;
  // Computed state from container (or directly provided for Storybook)
  isLiked?: boolean;
  likeCount?: number;
  canLike?: boolean;
  isLikeLoading?: boolean;
  onLike?: () => void;
  // Comments data from container (or directly provided for Storybook)
  commentsData?: CommentsSheetProps['comments'];
  commentCount?: number;
  canComment?: boolean;
  isCommentsLoading?: boolean;
  isCommentSubmitting?: boolean;
  onSubmitComment?: (content: string) => Promise<boolean>;
}

/**
 * TikTok-style desktop detail view with video on left, sidebar on right
 * Fullscreen experience for detailed video viewing
 *
 * PRESENTATIONAL COMPONENT - No business logic, only UI rendering
 * For integration with Lens Protocol, use VideoDetailContainer instead
 */
export const VideoDetail: React.FC<VideoDetailProps> = ({
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
  lensPostId,
  userHasLiked,
  onClose,
  currentVideoIndex,
  totalVideos,
  onNavigatePrevious,
  onNavigateNext,
  // Karaoke props
  lyricsUrl,
  lyricsFormat,
  segmentStart,
  segmentEnd,
  songTitle,
  // Computed state (provided by container or directly in Storybook)
  isLiked = false,
  likeCount = likes,
  canLike = false,
  isLikeLoading = false,
  onLike = () => console.log('[VideoDetail] Like clicked (no handler provided)'),
  // Comments data (provided by container or directly in Storybook)
  commentsData = [],
  commentCount: injectedCommentCount,
  canComment = false,
  isCommentsLoading = false,
  isCommentSubmitting = false,
  onSubmitComment = async () => { console.log('[VideoDetail] Comment submit (no handler)'); return false; }
}) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Start unmuted since user intentionally clicked video
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  // Touch handling for swipe navigation
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const getProfileRoute = () => {
    const profileId = creatorId || creatorHandle || username;
    const cleanId = profileId.replace('@', '');

    if (cleanId.startsWith('lens/') || cleanId.includes('lens/')) {
      const lensUsername = cleanId.replace('lens/', '');
      return `/profile/lens/${lensUsername}`;
    } else {
      return `/profile/${cleanId}`;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log('Play failed:', e));
      }
    }
  };

  // Touch event handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;

    const xDiff = touchStart.current.x - touchEnd.current.x;
    const yDiff = touchStart.current.y - touchEnd.current.y;

    // Check if this is a tap (small movement) vs swipe
    const isClick = Math.abs(xDiff) < 10 && Math.abs(yDiff) < 10;

    if (isClick) {
      // Tap detected - toggle play/pause
      togglePlayPause();
    } else if (Math.abs(yDiff) > Math.abs(xDiff)) {
      // Check if vertical swipe is more significant than horizontal
      if (yDiff > 50 && onNavigateNext) {
        // Swipe up = next video
        onNavigateNext();
      } else if (yDiff < -50 && onNavigatePrevious) {
        // Swipe down = previous video
        onNavigatePrevious();
      }
    }
  };

  // Auto-play video when component mounts (like main feed)
  React.useEffect(() => {
    if (videoRef.current && videoUrl) {
      const video = videoRef.current;
      // Start muted for mobile compatibility
      video.muted = true;
      setIsMuted(true);

      // Attempt autoplay after a short delay
      const timer = setTimeout(() => {
        video.play().catch(e => {
          console.log('[VideoDetail] Autoplay failed:', e);
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [videoUrl]);

  // HLS.js setup
  React.useEffect(() => {
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;

      if (videoUrl.endsWith('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
          });

          hls.loadSource(videoUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.log('Autoplay failed:', e));
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            console.error(`[VideoDetail] HLS error for @${username}:`, data);
          });

          return () => {
            hls.destroy();
          };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoUrl;
          video.play().catch(e => console.log('Autoplay failed:', e));
        }
      } else {
        video.src = videoUrl;
        video.play().catch(e => console.log('Autoplay failed:', e));
      }
    }
  }, [videoUrl, username]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && onNavigatePrevious) {
        e.preventDefault();
        onNavigatePrevious();
      } else if (e.key === 'ArrowDown' && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNavigatePrevious, onNavigateNext, onClose]);


  console.log('[VideoDetail] Rendering with props:', { videoUrl, username, description });

  // Mobile: Use exact same structure as homepage feed
  if (window.innerWidth < 768) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <VideoPost
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          username={username}
          description={description}
          likes={likes}
          comments={comments}
          shares={shares}
          musicTitle={songTitle || musicTitle}
          creatorHandle={creatorHandle}
          creatorId={creatorId}
          lensPostId={lensPostId}
          userHasLiked={userHasLiked}
          lyricsUrl={lyricsUrl}
          lyricsFormat={lyricsFormat}
          segmentStart={segmentStart}
          segmentEnd={segmentEnd}
          songTitle={songTitle}
          // Pass through computed state from container
          isLiked={isLiked}
          likeCount={likeCount}
          canLike={canLike}
          isLikeLoading={isLikeLoading}
          onLike={onLike}
          // Pass through comments data from container
          commentsData={commentsData}
          commentCount={injectedCommentCount || comments}
          canComment={canComment}
          isCommentsLoading={isCommentsLoading}
          isCommentSubmitting={isCommentSubmitting}
          onSubmitComment={onSubmitComment}
        />
        {/* Close button overlay - top right to avoid VideoPost mute button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[100] w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Desktop: Original layout with sidebar
  return (
    <div className="fixed inset-0 bg-neutral-900 z-50 flex">
        {/* Video Area - Left Side - Full Height */}
        <div className="flex-1 relative bg-neutral-900 flex items-center justify-center">
        {/* Close button - Top Left */}
        {onClose && (
          <div className="absolute top-4 left-4 z-10">
            <ActionButton icon={X} onClick={onClose} />
          </div>
        )}

        {/* Video Container - 9:16 aspect ratio, centered */}
        <div
          className="relative bg-neutral-900 rounded-lg overflow-hidden cursor-pointer"
          style={{ height: '90vh', width: 'calc(90vh * 9 / 16)', maxWidth: '100%' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={description}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
              <span className="text-white/50">No media available</span>
            </div>
          )}

          {/* Play/Pause Overlay - only show when paused */}
          {videoUrl && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-200">
              <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play className="w-10 h-10 text-white ml-1" weight="fill" />
              </div>
            </div>
          )}

          {/* Karaoke Lyrics Overlay */}
          {lyricsUrl && videoRef.current && (
            <KaraokeOverlay
              lyricsUrl={lyricsUrl}
              segmentStart={segmentStart}
              videoRef={videoRef as React.RefObject<HTMLVideoElement>}
              isPlaying={isPlaying}
            />
          )}
        </div>

        {/* Navigation Controls - Vertically centered on right side */}
        {totalVideos && totalVideos > 1 && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10 flex flex-col items-center space-y-4">
            <div className="opacity-90">
              <ActionButton
                icon={CaretUp}
                onClick={onNavigatePrevious}
                className={currentVideoIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
            <div className="opacity-90">
              <ActionButton
                icon={CaretDown}
                onClick={onNavigateNext}
                className={currentVideoIndex === (totalVideos - 1) ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
          </div>
        )}

        {/* Mute/Unmute button - Bottom Right outside video */}
        {videoUrl && (
          <div className="absolute bottom-4 right-4 z-10">
            <ActionButton
              icon={isMuted ? SpeakerX : SpeakerHigh}
              onClick={toggleMute}
            />
          </div>
        )}

      </div>

      {/* Right Sidebar - Fixed Width */}
      <div className="w-[400px] bg-neutral-900 flex flex-col h-full border-l border-neutral-800">
        {/* Profile Section */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(getProfileRoute())}
                className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                  alt={username}
                  className="w-full h-full rounded-full object-cover"
                />
              </button>
              <div>
                <button
                  onClick={() => navigate(getProfileRoute())}
                  className="hover:underline"
                >
                  <h3 className="font-semibold text-base text-white">@{username}</h3>
                </button>
                <p className="text-neutral-400">{creatorHandle || 'Creator'}</p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-[#FE2C55] text-white rounded font-medium hover:bg-[#FF0F3F] transition-colors">
              Follow
            </button>
          </div>
        </div>

        {/* Description Section */}
        <div className="p-4 border-b border-neutral-800">
          <p className="text-white leading-relaxed mb-3">{description}</p>
          <div className="flex items-center text-neutral-400">
            <MusicNote className="w-4 h-4 mr-2" />
            <span>{musicTitle}</span>
          </div>
        </div>

        {/* Engagement Section */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ActionButton
                icon={Heart}
                count={likeCount}
                onClick={onLike}
                isActive={isLiked}
                isLoading={isLikeLoading}
                disabled={!canLike}
              />
              <ActionButton icon={ChatCircle} count={comments} onClick={() => setCommentsOpen(true)} />
              <ActionButton icon={ShareNetwork} count={shares} onClick={() => setShareOpen(true)} />
            </div>
          </div>

        </div>

        {/* Comments Section */}
        <div className="flex-1 flex flex-col">
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {[
              { id: "1", username: "user123", text: "This is amazing! 🔥", likes: 12 },
              { id: "2", username: "creator_fan", text: "Love this content!", likes: 8 },
              { id: "3", username: "music_lover", text: "What's the song name?", likes: 5 },
              { id: "4", username: "style_icon", text: "Where did you get that outfit? 😍", likes: 15 },
              { id: "5", username: "dance_moves", text: "Tutorial please!", likes: 23 },
            ].map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                onLike={(commentId) => console.log('Liked comment:', commentId)}
              />
            ))}
          </div>

          {/* Comment Input */}
          <CommentInput
            onSubmit={(comment) => console.log('Comment submitted:', comment)}
            variant="compact"
            showAvatar={true}
          />
        </div>
      </div>

      {/* Desktop-only Sheets */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={lensPostId || ''}
        comments={commentsData}
        commentCount={injectedCommentCount || comments}
        canComment={canComment}
        isLoading={isCommentsLoading}
        isSubmitting={isCommentSubmitting}
        onSubmitComment={onSubmitComment}
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