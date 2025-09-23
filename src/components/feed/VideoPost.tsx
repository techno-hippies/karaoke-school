import React, { useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music, Volume2, VolumeX, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from './ActionButton';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import Hls from 'hls.js';

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
  creatorId,
  pkpPublicKey
}) => {

  // Log props received by VideoPost
  React.useEffect(() => {
    // Only log when needed for debugging
    // console.log(`[VideoPost] Component props for @${username}:`, { username, creatorHandle, creatorId });
  }, [videoUrl, username, description]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  
  // Determine the profile identifier and route to navigate to
  // Priority: creatorId (handle) > creatorHandle > username
  const getProfileRoute = () => {
    const profileId = creatorId || creatorHandle || username;
    const cleanId = profileId.replace('@', '');

    // Check if this is a Lens handle
    if (cleanId.startsWith('lens/') || cleanId.includes('lens/')) {
      const lensUsername = cleanId.replace('lens/', '');
      console.log('[Profile] Building Lens profile route:', {
        profileId,
        cleanId,
        lensUsername,
        finalRoute: `/profile/lens/${lensUsername}`
      });
      return `/profile/lens/${lensUsername}`;
    } else {
      console.log('[Profile] Building regular profile route:', {
        profileId,
        cleanId,
        finalRoute: `/profile/${cleanId}`
      });
      return `/profile/${cleanId}`;
    }
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  // Setup HLS.js for HLS streaming
  React.useEffect(() => {
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;

      // console.log(`[VideoPost] Loading video for @${username}:`, videoUrl);

      // Check if it's an HLS stream
      if (videoUrl.endsWith('.m3u8')) {
        // console.log(`[VideoPost] HLS stream detected for @${username}`);

        if (Hls.isSupported()) {
          // console.log(`[VideoPost] HLS.js supported, creating player for @${username}`);

          const hls = new Hls({
            debug: false, // Disable verbose debug logs
            enableWorker: true,
            lowLatencyMode: true,
          });

          hls.loadSource(videoUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // console.log(`[VideoPost] HLS manifest parsed for @${username}, starting playback`);
            video.play().catch(e => console.log('Autoplay failed:', e));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error(`[VideoPost] HLS error for @${username}:`, data);
            if (data.fatal) {
              console.error(`[VideoPost] HLS fatal error for @${username}:`, data);
            }
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            // console.log(`[VideoPost] HLS media attached for @${username}`);
          });

          return () => {
            // console.log(`[VideoPost] Destroying HLS player for @${username}`);
            hls.destroy();
          };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          console.log(`[VideoPost] Using native HLS support for @${username}`);
          video.src = videoUrl;
          video.play().catch(e => console.log('Autoplay failed:', e));
        } else {
          console.warn(`[VideoPost] HLS not supported for @${username}`);
        }
      } else {
        // Regular video URL (MP4, etc)
        console.log(`[VideoPost] Regular video URL for @${username}`);
        video.src = videoUrl;
        video.play().catch(e => console.log('Autoplay failed:', e));
      }
    } else {
      console.log(`[VideoPost] No video URL provided for @${username}`);
    }
  }, [videoUrl, username]);
  
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="relative h-screen w-full bg-black snap-start flex items-center justify-center">
      {/* Video/Thumbnail Background - mobile: full screen, desktop: 9:16 centered */}
      <div className="relative w-full h-full md:w-[56vh] md:h-[90vh] md:max-w-[500px] md:max-h-[900px] bg-neutral-900 md:rounded-lg overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            loop
            muted={isMuted}
            playsInline
            poster={thumbnailUrl}
          />
        ) : thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={description}
            className="w-full h-full object-cover"
          />
        ) : null}
        
        {/* Mute/Unmute button - top left of video */}
        {videoUrl && (
          <button
            onClick={toggleMute}
            className="absolute top-4 left-4 p-2"
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
              const profileRoute = getProfileRoute();
              console.log(`[Profile] Username clicked - navigating to: ${profileRoute}`);
              navigate(profileRoute);
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
                const profileRoute = getProfileRoute();
                console.log(`[Profile] Mobile avatar clicked - navigating to: ${profileRoute}`);
                navigate(profileRoute);
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
              const profileRoute = getProfileRoute();
              console.log(`[Profile] Mobile username clicked - navigating to: ${profileRoute}`);
              navigate(profileRoute);
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
              const profileRoute = getProfileRoute();
              console.log(`[Profile] Avatar clicked - navigating to: ${profileRoute}`);
              try {
                navigate(profileRoute);
                console.log(`[Profile] Navigation successful`);
              } catch (error) {
                console.error(`[Profile] Navigation failed:`, error);
              }
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