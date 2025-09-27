import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PostEditor } from '../ui/PostEditor';
import { getSongById } from '../../lib/song-directory';

interface LocationState {
  segment?: any;
  videoBlob?: Blob;
  videoThumbnail?: string;
}

export const PostEditorPage: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load song data to get audioUrl
  useEffect(() => {
    const loadSong = async () => {
      if (!songId) {
        setLoading(false);
        return;
      }

      try {
        console.log('[PostEditorPage] Loading song:', songId);
        const songData = await getSongById(songId);
        setSong(songData);
        console.log('[PostEditorPage] Song loaded:', songData);
      } catch (error) {
        console.error('[PostEditorPage] Failed to load song:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [songId]);

  const handleBack = () => {
    console.log('[PostEditorPage] Going back to camera recorder');
    // Navigate back to camera recorder to re-record
    navigate(`/create/camera-recorder/${songId}`, {
      state: { segment: state?.segment } // Pass segment data back
    });
  };

  const handlePost = (caption: string) => {
    console.log('[PostEditorPage] Posting with caption:', caption);
    console.log('[PostEditorPage] Video data:', {
      videoBlob: state?.videoBlob,
      videoThumbnail: state?.videoThumbnail,
      segment: state?.segment
    });

    // TODO: Implement actual posting logic
    // For now, navigate back to home
    navigate('/');
  };

  const handleLensPost = (result: { postId: string; metadataUri: string; videoUri: string }) => {
    console.log('[PostEditorPage] Lens post created successfully:', result);

    // TODO: Show success message and navigate to feed or post view
    // For now, navigate back to home
    navigate('/', {
      state: {
        success: true,
        message: 'Karaoke video posted to Lens Protocol!',
        postId: result.postId
      }
    });
  };

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-400 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <PostEditor
      videoBlob={state?.videoBlob}
      videoThumbnail={state?.videoThumbnail}
      segment={state?.segment}
      audioUrl={song?.audioUrl}
      songId={songId}
      songTitle={song?.title}
      onBack={handleBack}
      onPost={handlePost}
      onLensPost={handleLensPost}
    />
  );
};