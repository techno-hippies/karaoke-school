import React, { useState, useRef, useEffect } from 'react';
import { CaretLeft, Play } from '@phosphor-icons/react';
import { createKaraokePost, canCreatePosts, getLensAccountInfo, type PostProgress } from '../../lib/lens/posting';
import { useAccount, useWalletClient } from 'wagmi';

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: Array<{ text: string; timestamp: number }>;
}

interface PostEditorProps {
  videoThumbnail?: string;
  videoBlob?: Blob;
  segment?: SelectedSegment;
  audioUrl?: string;
  songId?: string;
  songTitle?: string;
  onBack?: () => void;
  onPost?: (caption: string) => void;
  onLensPost?: (result: { postId: string; metadataUri: string; videoUri: string }) => void;
  maxCaptionLength?: number;
  className?: string;
}

export const PostEditor: React.FC<PostEditorProps> = ({
  videoThumbnail,
  videoBlob,
  segment,
  audioUrl,
  songId,
  songTitle,
  onBack,
  onPost,
  onLensPost,
  maxCaptionLength = 1000,
  className = ''
}) => {
  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState<PostProgress | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get wallet connection for Lens posting
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Debug logging
  console.log('[PostEditor] Props:', {
    videoThumbnail: !!videoThumbnail,
    videoBlob: !!videoBlob,
    videoBlobSize: videoBlob?.size,
    videoBlobType: videoBlob?.type,
    segment: !!segment,
    audioUrl: !!audioUrl
  });

  // Create video URL when videoBlob changes
  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      console.log('[PostEditor] Created video URL:', url);

      // Cleanup previous URL
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
          console.log('[PostEditor] Revoked video URL:', url);
        }
      };
    }
  }, [videoBlob]);


  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCaption = e.target.value;
    if (newCaption.length <= maxCaptionLength) {
      setCaption(newCaption);
    }
  };

  // Check if user can post to Lens
  const canPostToLens = canCreatePosts() && isWalletConnected && walletClient && videoBlob && segment;
  const lensAccountInfo = getLensAccountInfo();

  console.log('[PostEditor] Debug state:', {
    canCreatePosts: canCreatePosts(),
    isWalletConnected,
    hasWalletClient: !!walletClient,
    hasVideoBlob: !!videoBlob,
    hasSegment: !!segment,
    canPostToLens,
    lensAccountInfo
  });

  const handlePost = async () => {
    if (canPostToLens && videoBlob && segment && songId && walletClient && walletAddress) {
      // Post to Lens
      await handleLensPost();
    } else {
      // Fallback to local posting
      onPost?.(caption);
    }
  };

  const handleLensPost = async () => {
    if (!canPostToLens || !videoBlob || !segment || !songId) {
      console.warn('[PostEditor] Cannot post to Lens: missing requirements');
      return;
    }

    if (!walletClient || !walletAddress) {
      console.warn('[PostEditor] Cannot post to Lens: no wallet connection');
      return;
    }

    setIsPosting(true);
    try {
      console.log('[PostEditor] Starting Lens post creation...');

      const result = await createKaraokePost(
        {
          videoBlob,
          caption: caption.trim() || `🎤 Karaoke performance! ${songTitle ? `Singing "${songTitle}"` : ''}`,
          songId,
          songTitle,
          segment
        },
        walletClient,
        walletAddress,
        (progress) => {
          console.log('[PostEditor] Post progress:', progress);
          setPostProgress(progress);
        }
      );

      console.log('[PostEditor] Lens post created successfully:', result);
      onLensPost?.(result);

    } catch (error) {
      console.error('[PostEditor] Lens post creation failed:', error);
      // TODO: Show error toast to user
    } finally {
      setIsPosting(false);
      setPostProgress(null);
    }
  };


  const handlePlayPause = async () => {
    if (videoRef.current && videoUrl) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          // Ensure video is loaded before playing
          if (videoRef.current.readyState < 3) {
            console.log('[PostEditor] Video not ready, loading first...');
            await new Promise((resolve) => {
              const onCanPlay = () => {
                videoRef.current?.removeEventListener('canplay', onCanPlay);
                resolve(void 0);
              };
              videoRef.current?.addEventListener('canplay', onCanPlay);
              videoRef.current?.load();
            });
          }

          console.log('[PostEditor] Attempting to play video...');
          await videoRef.current.play();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('[PostEditor] Video play error:', error);
        // Reset the video element
        if (videoRef.current) {
          videoRef.current.load();
          console.log('[PostEditor] Reloaded video element');
        }
      }
    }
  };

  return (
    <div className={`relative w-full h-screen bg-neutral-900 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>

          <div className="flex-1 mx-4">
            <h1 className="text-white text-lg font-semibold text-center">Post</h1>
          </div>

          {/* Spacer to balance the layout */}
          <div className="w-12"></div>
        </div>
      </div>

      {/* Main content */}
      <div className="pb-20 px-4 pt-8 mt-4">
        {/* Video Preview - 9:16 aspect ratio */}
        <div className="mb-6 flex justify-center">
          <div className="relative w-64 bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700" style={{ height: '28.44rem' }}>
            {videoThumbnail ? (
              <>
                <img
                  src={videoThumbnail}
                  alt="Video preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 hover:bg-opacity-30 transition-all"
                >
                  <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </button>
              </>
            ) : videoBlob && videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-cover cursor-pointer"
                loop
                playsInline
                preload="auto"
                controls
                onClick={handlePlayPause}
              />
            ) : (
              <>
                <img
                  src="https://picsum.photos/400/600?random=placeholder"
                  alt="Video placeholder"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>



        {/* Lens Account Info */}
        {lensAccountInfo && (
          <div className="mb-4 p-3 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-400 text-sm font-medium">Lens Account Connected</span>
            </div>
            <p className="text-neutral-300 text-sm mt-1">
              {lensAccountInfo.username || `${lensAccountInfo.address.slice(0, 6)}...${lensAccountInfo.address.slice(-4)}`}
            </p>
          </div>
        )}

        {/* Post Progress */}
        {isPosting && postProgress && (
          <div className="mb-6 p-4 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-400 font-medium">Posting to Lens...</span>
            </div>
            <p className="text-blue-300 text-sm mb-2">{postProgress.message}</p>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${postProgress.progress * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Caption Input */}
        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-2">
            Caption {caption.length > 0 && (
              <span className="text-neutral-400">({caption.length}/{maxCaptionLength})</span>
            )}
          </label>
          <textarea
            value={caption}
            onChange={handleCaptionChange}
            placeholder="Write a caption within 1000 characters"
            className="w-full bg-neutral-800 text-white placeholder-neutral-400 rounded-lg border border-neutral-700 focus:border-blue-500 focus:outline-none p-4 resize-none min-h-[120px] max-h-[200px]"
            rows={4}
            disabled={isPosting}
          />
        </div>
      </div>

      {/* Post Button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-900">
        <button
          onClick={handlePost}
          disabled={isPosting || !caption.trim()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors text-white font-semibold text-lg rounded-lg"
        >
          {isPosting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
};