import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PostEditor } from '../ui/PostEditor';
import { getSongById } from '../../lib/song-directory';

interface LocationState {
  segment?: {
    start: number;
    end: number;
    lyrics: Array<{
      start: number;
      end: number;
      text: string;
    }>;
    [key: string]: unknown;
  };
  videoBlob?: Blob;
  videoThumbnail?: string;
}

interface PostEditorSegment {
  start: number;
  end: number;
  lyrics: Array<{ text: string; timestamp: number }>;
}

export const PostEditorPage: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [song, setSong] = useState<{
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    [key: string]: unknown;
  } | null>(null);
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
        setSong(songData ? {
          ...songData,
          audioUrl: songData.audioUrl || ''
        } : null);
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

  const convertedSegment: PostEditorSegment | undefined = state?.segment ? {
    start: state.segment.start,
    end: state.segment.end,
    lyrics: state.segment.lyrics.map(lyric => ({
      text: lyric.text,
      timestamp: lyric.start
    }))
  } : undefined;

  return (
    <PostEditor
      videoBlob={state?.videoBlob}
      videoThumbnail={state?.videoThumbnail}
      segment={convertedSegment}
      audioUrl={song?.audioUrl}
      songId={songId}
      songTitle={song?.title}
      onBack={handleBack}
      onPost={handlePost}
      onLensPost={handleLensPost}
    />
  );
};