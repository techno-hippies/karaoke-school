import React, { useState, useRef, useEffect } from 'react';
import { CaretLeft, Play } from '@phosphor-icons/react';

// Remove old posting system import - now using unified auth
export interface PostProgress {
  stage: 'authenticating' | 'uploading_video' | 'uploading_metadata' | 'creating_post' | 'completed';
  progress: number; // 0-1
  message: string;
}
import { post } from '@lens-protocol/client/actions';
import { video, MediaVideoMimeType, MetadataLicenseType } from "@lens-protocol/metadata";
import { uri } from "@lens-protocol/client";
import { uploadVideoToGrove, uploadMetadataToGrove } from '../../lib/lens/storage';
import { getRegistrySongById } from '../../lib/songs/grove-registry';
import type { EmbeddedKaraokeSegment, LineTimestamp, WordTimestamp } from '../../types/feed';

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
  // Dependency injection for Storybook compatibility
  walletAddress?: string;
  isWalletConnected?: boolean;
  walletClient?: any;
  sessionClient?: any;
  isAuthenticated?: boolean;
  authenticatedUser?: any;
  canPost?: boolean;
  authState?: string;
  onLogin?: () => void;
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
  className = '',
  // Injected dependencies (for Storybook or testing)
  walletAddress: injectedWalletAddress,
  isWalletConnected: injectedIsWalletConnected,
  walletClient: injectedWalletClient,
  sessionClient: injectedSessionClient,
  isAuthenticated: injectedIsAuthenticated = false,
  authenticatedUser: injectedAuthenticatedUser,
  canPost: injectedCanPost = false,
  authState: injectedAuthState = 'unauthenticated',
  onLogin: injectedOnLogin,
}) => {
  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState<PostProgress | null>(null);
  const [songData, setSongData] = useState<any>(null); // Store Grove registry song data
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use injected values (for Storybook) or default empty values
  const walletAddress = injectedWalletAddress;
  const isWalletConnected = injectedIsWalletConnected || false;
  const walletClient = injectedWalletClient;
  const sessionClient = injectedSessionClient;
  const isAuthenticated = injectedIsAuthenticated;
  const authenticatedUser = injectedAuthenticatedUser;
  const canPost = injectedCanPost;
  const authState = injectedAuthState;
  const handleLogin = injectedOnLogin || (() => console.log('[PostEditor] Login clicked (no handler)'));

  // Debug logging
  console.log('[PostEditor] Props:', {
    videoThumbnail: !!videoThumbnail,
    videoBlob: !!videoBlob,
    videoBlobSize: videoBlob?.size,
    videoBlobType: videoBlob?.type,
    segment: !!segment,
    audioUrl: !!audioUrl,
    songId
  });

  // Fetch song data from Grove registry
  useEffect(() => {
    if (songId) {
      console.log('[PostEditor] Fetching song data for:', songId);
      getRegistrySongById(songId)
        .then(song => {
          console.log('[PostEditor] Song data loaded:', song);
          setSongData(song);
        })
        .catch(error => {
          console.error('[PostEditor] Failed to load song data:', error);
        });
    }
  }, [songId]);

  // Helper function to extract segment lyrics from full song data
  const extractSegmentLyrics = async (songId: string, segmentStart: number, segmentEnd: number): Promise<LineTimestamp[]> => {
    try {
      console.log('[PostEditor] Extracting segment lyrics for:', { songId, segmentStart, segmentEnd });

      if (!songData?.timestampsUri) {
        console.warn('[PostEditor] No timestampsUri in song data');
        return [];
      }

      // Fetch full song lyrics from Grove Storage
      const response = await fetch(songData.timestampsUri.replace('lens://', 'https://api.grove.storage/'));
      const fullLyricsData = await response.json();

      console.log('[PostEditor] Full lyrics data loaded:', fullLyricsData);

      // Handle both Grove Storage format ('lines') and legacy format ('lineTimestamps')
      const fullLines = fullLyricsData.lines || fullLyricsData.lineTimestamps || [];

      // Filter lines that appear within the segment
      const segmentLines: LineTimestamp[] = [];

      for (const line of fullLines) {
        // Check if line overlaps with segment
        const lineStart = line.start;
        const lineEnd = line.end;

        if (lineEnd >= segmentStart && lineStart <= segmentEnd) {
          // Line appears in segment, adjust timing to be video-relative
          const adjustedLine: LineTimestamp = {
            lineIndex: line.lineIndex,
            originalText: line.originalText,
            translatedText: line.translatedText,
            start: Math.max(0, lineStart - segmentStart), // Video-relative time
            end: Math.min(segmentEnd - segmentStart, lineEnd - segmentStart), // Video-relative time
            wordCount: line.wordCount,
            words: line.words ? line.words.map((word: any) => ({
              text: word.text,
              start: Math.max(0, word.start - segmentStart), // Video-relative time
              end: Math.min(segmentEnd - segmentStart, word.end - segmentStart) // Video-relative time
            })).filter((word: WordTimestamp) => word.start < segmentEnd - segmentStart) : undefined
          };

          segmentLines.push(adjustedLine);
        }
      }

      console.log('[PostEditor] Extracted segment lines:', segmentLines);
      return segmentLines;
    } catch (error) {
      console.error('[PostEditor] Failed to extract segment lyrics:', error);
      return [];
    }
  };

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

  // Check if user can post to Lens using unified authentication system
  const canPostToLens = canPost && sessionClient && isWalletConnected && walletClient && videoBlob && segment;

  // Get account info from the authenticated user
  const lensAccountInfo = authenticatedUser ? {
    address: authenticatedUser.address,
    username: undefined // Add username lookup if needed
  } : null;

  // Function to create karaoke post using the session client from React context
  const createKaraokePostWithSessionClient = async (postData: {
    videoBlob: Blob;
    caption: string;
    songId: string;
    songTitle?: string;
    segment: SelectedSegment;
  }) => {
    if (!sessionClient) {
      throw new Error('No authenticated session client available');
    }

    console.log('[PostEditor] Creating karaoke post with session client from React context...');

    // Step 1: Upload video to Grove
    setPostProgress({
      stage: 'uploading_video',
      progress: 0.1,
      message: 'Uploading video to storage...'
    });

    const videoResult = await uploadVideoToGrove(postData.videoBlob, sessionClient);

    setPostProgress({
      stage: 'uploading_video',
      progress: 1.0,
      message: 'Video uploaded successfully'
    });

    // Step 2: Create video metadata
    setPostProgress({
      stage: 'uploading_metadata',
      progress: 0.1,
      message: 'Creating video metadata...'
    });

    const segmentDuration = Math.round((postData.segment.end - postData.segment.start) * 1000);
    const mimeType = postData.videoBlob.type || 'video/webm';
    const videoMimeType = mimeType.includes('mp4') ? MediaVideoMimeType.MP4 : MediaVideoMimeType.WEBM;

    // Extract segment lyrics and create embedded data
    const segmentLines = await extractSegmentLyrics(postData.songId, postData.segment.start, postData.segment.end);

    const embeddedKaraokeSegment: EmbeddedKaraokeSegment = {
      songId: postData.songId,
      songTitle: postData.songTitle || songData?.title || 'Unknown Song',
      artist: songData?.artist,
      segmentStart: postData.segment.start,
      segmentEnd: postData.segment.end,
      videoStart: 0,
      videoEnd: segmentDuration / 1000, // Convert to seconds
      lines: segmentLines,
      fullSongTimestampsUri: songData?.timestampsUri,
      audioUri: songData?.audioUri
    };

    const videoMetadata = video({
      title: `Karaoke: ${postData.songTitle || 'Song Performance'}`,
      video: {
        item: videoResult.uri,
        type: videoMimeType,
        duration: segmentDuration,
        altTag: `Karaoke performance of ${postData.songTitle || 'a song'}`,
        license: MetadataLicenseType.CCO,
      },
      content: postData.caption || `🎤 Karaoke performance! ${postData.songTitle ? `Singing "${postData.songTitle}"` : ''}`,
      attributes: [
        {
          key: 'app_type',
          value: 'karaoke',
          type: 'String'
        },
        {
          key: 'video_gateway_url',
          value: videoResult.gatewayUrl,
          type: 'String'
        },
        {
          key: 'karaoke_segment_data',
          value: JSON.stringify(embeddedKaraokeSegment),
          type: 'String'
        }
      ]
    });

    console.log('[PostEditor] Creating video metadata with embedded karaoke segment:', {
      songId: postData.songId,
      songData,
      embeddedKaraokeSegment,
      segmentLinesCount: segmentLines.length,
      attributes: videoMetadata.attributes
    });

    // Step 3: Upload metadata to Grove
    const metadataResult = await uploadMetadataToGrove(videoMetadata, sessionClient);

    setPostProgress({
      stage: 'uploading_metadata',
      progress: 1.0,
      message: 'Metadata uploaded successfully'
    });

    // Step 4: Create Lens post using the authenticated session client from React context
    setPostProgress({
      stage: 'creating_post',
      progress: 0.1,
      message: 'Creating Lens post...'
    });

    console.log('[PostEditor] Using sessionClient from React context:', {
      hasSessionClient: !!sessionClient,
      authenticatedUser: authenticatedUser
    });

    const postResult = await post(sessionClient, {
      contentUri: uri(metadataResult.uri)
    });

    if (postResult.isErr()) {
      throw new Error(`Failed to create Lens post: ${postResult.error?.message || 'Unknown error'}`);
    }

    setPostProgress({
      stage: 'completed',
      progress: 1.0,
      message: 'Karaoke post created successfully!'
    });

    const postResultData = postResult.value;
    const postId = postResultData.hash || postResultData.txHash || 'unknown';

    return {
      postId,
      metadataUri: metadataResult.uri,
      videoUri: videoResult.uri
    };
  };

  console.log('[PostEditor] Debug state:', {
    isAuthenticated,
    canPost,
    authState,
    hasSessionClient: !!sessionClient,
    hasAuthenticatedUser: !!authenticatedUser,
    userRole: authenticatedUser?.role,
    isWalletConnected,
    hasWalletClient: !!walletClient,
    hasVideoBlob: !!videoBlob,
    hasSegment: !!segment,
    canPostToLens,
    lensAccountInfo
  });

  const handlePost = async () => {
    if (canPostToLens && videoBlob && segment && songId) {
      // Post to Lens using the session client from React context
      setIsPosting(true);
      try {
        console.log('[PostEditor] Starting Lens post creation...');

        const result = await createKaraokePostWithSessionClient({
          videoBlob,
          caption: caption.trim() || `🎤 Karaoke performance! ${songTitle ? `Singing "${songTitle}"` : ''}`,
          songId,
          songTitle,
          segment
        });

        console.log('[PostEditor] Lens post created successfully:', result);
        onLensPost?.(result);

      } catch (error) {
        console.error('[PostEditor] Lens post creation failed:', error);
        // TODO: Show error toast to user
      } finally {
        setIsPosting(false);
        setPostProgress(null);
      }
    } else {
      // Fallback to local posting
      onPost?.(caption);
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



        {/* Authentication Status */}
        {authState === 'needs-account' && (
          <div className="mb-4 p-3 bg-yellow-900 bg-opacity-30 rounded-lg border border-yellow-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-yellow-400 text-sm font-medium">Lens Account Required</span>
            </div>
            <p className="text-yellow-300 text-sm mt-1">
              You need to create a Lens account to post videos.
            </p>
            <button
              onClick={handleLogin}
              className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-md transition-colors"
            >
              Create Lens Account
            </button>
          </div>
        )}

        {authState === 'checking' && (
          <div className="mb-4 p-3 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-400 text-sm font-medium">Setting up Lens authentication...</span>
            </div>
          </div>
        )}

        {/* Lens Account Info */}
        {lensAccountInfo && canPost && (
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

        {lensAccountInfo && !canPost && authenticatedUser?.role === 'ONBOARDING_USER' && (
          <div className="mb-4 p-3 bg-orange-900 bg-opacity-30 rounded-lg border border-orange-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span className="text-orange-400 text-sm font-medium">Account Setup Required</span>
            </div>
            <p className="text-orange-300 text-sm mt-1">
              Your Lens account is being set up. Please try again in a moment.
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