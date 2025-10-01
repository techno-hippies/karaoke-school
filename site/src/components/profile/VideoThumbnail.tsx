import React, { useRef, useEffect, useState } from 'react';
import { Play } from '@phosphor-icons/react';

interface VideoThumbnailProps {
  thumbnailUrl: string;
  thumbnailSourceUrl?: string; // Low-res MP4 for client-side generation
  playCount: number;
  videoUrl?: string;
  onClick?: () => void;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  thumbnailUrl,
  thumbnailSourceUrl,
  // playCount,
  // videoUrl,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generatedThumbnail, setGeneratedThumbnail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Format play count with K/M suffixes
  // const formatPlayCount = (count: number): string => {
  //   if (count >= 1000000) {
  //     return `${(count / 1000000).toFixed(1)}M`;
  //   }
  //   if (count >= 1000) {
  //     return `${(count / 1000).toFixed(1)}K`;
  //   }
  //   return count.toString();
  // };

  // Generate thumbnail from low-res MP4
  useEffect(() => {
    if (thumbnailSourceUrl && videoRef.current && canvasRef.current && !generatedThumbnail) {
      setIsGenerating(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;

      video.src = thumbnailSourceUrl;
      video.muted = true;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';

      const onLoadedData = () => {
        video.currentTime = 1; // Seek to 1 second
      };

      const onSeeked = () => {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');

          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailDataUrl = canvas.toDataURL('image/png');
            setGeneratedThumbnail(thumbnailDataUrl);
          } else {
            console.error('[VideoThumbnail] Failed to generate thumbnail: invalid video dimensions');
          }
        } catch (error) {
          console.error('[VideoThumbnail] Error generating thumbnail:', error);
        } finally {
          setIsGenerating(false);
        }

        // Cleanup event listeners
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
      };

      const onError = (error: Event) => {
        console.error('[VideoThumbnail] Video load error:', error);
        setIsGenerating(false);
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);

      // Cleanup function
      return () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
    }
  }, [thumbnailSourceUrl, generatedThumbnail]);

  return (
    <div
      className="relative aspect-[9/16] bg-[#161823] overflow-hidden cursor-pointer group rounded-md"
      onClick={onClick}
    >
      {/* Generated or Static Thumbnail */}
      {generatedThumbnail ? (
        <img
          src={generatedThumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : isGenerating ? (
        <div className="w-full h-full bg-gray-800 relative overflow-hidden">
          {/* Skeleton loading animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-[shimmer_2s_infinite]"></div>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-800 relative overflow-hidden">
          {/* Static skeleton when no source available */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800"></div>
        </div>
      )}

      {/* Hidden Video and Canvas for Generation */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hover Overlay - Desktop only */}
      <div className="hidden md:flex absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 items-center justify-center">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Play className="w-8 h-8 text-white ml-1" weight="fill" />
        </div>
      </div>

    </div>
  );
};