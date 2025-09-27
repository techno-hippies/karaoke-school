import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CaretLeft, Play, Pause } from '@phosphor-icons/react';

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: any[];
}

interface PostEditorProps {
  videoThumbnail?: string;
  videoBlob?: Blob;
  segment?: SelectedSegment;
  audioUrl?: string;
  onBack?: () => void;
  onPost?: (caption: string) => void;
  maxCaptionLength?: number;
  className?: string;
}

export const PostEditor: React.FC<PostEditorProps> = ({
  videoThumbnail,
  videoBlob,
  segment,
  audioUrl,
  onBack,
  onPost,
  maxCaptionLength = 1000,
  className = ''
}) => {
  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handlePost = () => {
    onPost?.(caption);
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



        {/* Caption Input */}
        <div className="mb-6">
          <textarea
            value={caption}
            onChange={handleCaptionChange}
            placeholder="Write a caption within 1000 characters"
            className="w-full bg-neutral-800 text-white placeholder-neutral-400 rounded-lg border border-neutral-700 focus:border-blue-500 focus:outline-none p-4 resize-none min-h-[120px] max-h-[200px]"
            rows={4}
          />
        </div>
      </div>

      {/* Post Button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-900">
        <button
          onClick={handlePost}
          disabled={!caption.trim()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors text-white font-semibold text-lg rounded-lg"
        >
          Post
        </button>
      </div>
    </div>
  );
};