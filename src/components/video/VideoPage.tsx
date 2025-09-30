import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoDetail } from '../feed/VideoDetail';
import { getLensUserPosts } from '../../lib/feed';
import type { LensFeedItem } from '../../types/feed';

interface VideoPageProps {}

/**
 * Individual video page component
 * Handles standalone video viewing with shareable URLs
 */
export const VideoPage: React.FC<VideoPageProps> = () => {
  const { username, addressOrEns, videoId } = useParams<{
    username?: string;
    addressOrEns?: string;
    videoId: string;
  }>();

  console.log('[VideoPage] Route params:', { username, addressOrEns, videoId });
  console.log('[VideoPage] Window dimensions:', { width: window.innerWidth, height: window.innerHeight });
  const navigate = useNavigate();

  const [video, setVideo] = useState<LensFeedItem | null>(null);
  const [allVideos, setAllVideos] = useState<LensFeedItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the specific video and all videos from this profile
  useEffect(() => {
    const profileId = username ? `lens/${username}` : addressOrEns;

    if (!profileId || !videoId) {
      setError('Invalid video URL');
      setLoading(false);
      return;
    }

    const loadVideo = async () => {
      try {
        setLoading(true);

        // Fetch all videos from this profile
        const profileToQuery = username || addressOrEns;
        const profileVideos = await getLensUserPosts(profileToQuery!);

        if (profileVideos.length === 0) {
          setError('No videos found for this profile');
          setLoading(false);
          return;
        }

        // Find the specific video by ID
        const targetVideo = profileVideos.find(v => v.id === videoId);

        if (!targetVideo) {
          setError('Video not found');
          setLoading(false);
          return;
        }

        // Set video data
        setVideo(targetVideo);
        setAllVideos(profileVideos);

        // Find current video index for navigation
        const index = profileVideos.findIndex(v => v.id === videoId);
        setCurrentVideoIndex(index >= 0 ? index : 0);

        setLoading(false);
      } catch (err) {
        console.error('[VideoPage] Error loading video:', err);
        setError('Failed to load video');
        setLoading(false);
      }
    };

    loadVideo();
  }, [username, addressOrEns, videoId]);

  const handleClose = () => {
    // Navigate back to profile page
    if (username) {
      navigate(`/profile/lens/${username}`);
    } else {
      navigate(`/profile/${addressOrEns}`);
    }
  };

  const handleNavigatePrevious = () => {
    if (currentVideoIndex <= 0 || !allVideos.length) return;

    const newIndex = currentVideoIndex - 1;
    const newVideo = allVideos[newIndex];

    // Navigate to previous video URL
    if (username) {
      navigate(`/profile/lens/${username}/video/${newVideo.id}`);
    } else {
      navigate(`/profile/${addressOrEns}/video/${newVideo.id}`);
    }
  };

  const handleNavigateNext = () => {
    if (currentVideoIndex >= allVideos.length - 1 || !allVideos.length) return;

    const newIndex = currentVideoIndex + 1;
    const newVideo = allVideos[newIndex];

    // Navigate to next video URL
    if (username) {
      navigate(`/profile/lens/${username}/video/${newVideo.id}`);
    } else {
      navigate(`/profile/${addressOrEns}/video/${newVideo.id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Loading video...</div>
      </div>
    );
  }

  // Error state
  if (error || !video) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="mb-4">{error || 'Video not found'}</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Get display username (abbreviate if it's a long address)
  const displayUsername = video.creatorHandle.startsWith('0x') && video.creatorHandle.length === 42
    ? `${video.creatorHandle.slice(0, 6)}...${video.creatorHandle.slice(-4)}`
    : video.creatorHandle;

  return (
    <VideoDetail
      videoUrl={video.data.videoUrl}
      thumbnailUrl={video.data.videoUrl} // Use video URL as thumbnail
      username={displayUsername}
      description={video.data.description}
      likes={video.data.likes}
      comments={video.data.comments}
      shares={video.data.shares}
      musicTitle="Original Sound"
      creatorHandle={video.creatorHandle}
      creatorId={username ? `lens/${username}` : addressOrEns}
      lensPostId={video.id}
      userHasLiked={video.data.userHasLiked}
      onClose={handleClose}
      currentVideoIndex={currentVideoIndex}
      totalVideos={allVideos.length}
      onNavigatePrevious={handleNavigatePrevious}
      onNavigateNext={handleNavigateNext}
    />
  );
};