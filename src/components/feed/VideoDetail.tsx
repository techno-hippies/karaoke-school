import React, { useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music, Volume2, VolumeX, X, ChevronUp, ChevronDown, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from './ActionButton';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { Comment } from './Comment';
import { CommentInput } from './CommentInput';
import Hls from 'hls.js';

interface VideoDetailProps {
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
  onClose?: () => void;
  // Navigation props
  currentVideoIndex?: number;
  totalVideos?: number;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
}

/**
 * TikTok-style desktop detail view with video on left, sidebar on right
 * Fullscreen experience for detailed video viewing
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
  pkpPublicKey,
  onClose,
  currentVideoIndex,
  totalVideos,
  onNavigatePrevious,
  onNavigateNext
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

          hls.on(Hls.Events.ERROR, (event, data) => {
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

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

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
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Controls - Vertically centered on right side */}
        {totalVideos && totalVideos > 1 && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10 flex flex-col items-center space-y-4">
            <div className="opacity-90">
              <ActionButton
                icon={ChevronUp}
                onClick={onNavigatePrevious}
                className={currentVideoIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
            <div className="opacity-90">
              <ActionButton
                icon={ChevronDown}
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
              icon={isMuted ? VolumeX : Volume2}
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
            <Music className="w-4 h-4 mr-2" />
            <span>{musicTitle}</span>
          </div>
        </div>

        {/* Engagement Section */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ActionButton icon={Heart} count={likes} />
              <ActionButton icon={MessageCircle} count={comments} />
              <ActionButton icon={Share2} count={shares} onClick={() => setShareOpen(true)} />
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

      {/* Sheets for mobile compatibility */}
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