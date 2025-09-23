import { useMachine } from '@xstate/react';
import { feedMachine, type FeedVideo } from '../machines/feedMachine';
import { useEffect } from 'react';
import { useSubgraphFeed } from './useSubgraphFeed';

// Transform subgraph data to feed format
function transformToFeedVideo(item: any): FeedVideo {
  // Extract playback ID from Livepeer URL if present
  const extractPlaybackId = (url: string): string | null => {
    const match = url.match(/\/hls\/([^/]+)\//);
    return match ? match[1] : null;
  };
  
  return {
    id: item.id,
    url: item.data.videoUrl,
    username: item.data.username || 'unknown',
    description: item.data.description || '',
    likes: item.data.likes || 0,
    comments: item.data.comments || 0,
    shares: item.data.shares || 0,
    playbackId: extractPlaybackId(item.data.videoUrl),
  };
}

export function useFeedMachine() {
  const [state, send, actor] = useMachine(feedMachine);
  const { data: feedItems, isLoading } = useSubgraphFeed();
  
  // Load videos when feed data is available
  useEffect(() => {
    if (feedItems && feedItems.length > 0) {
      const videos = feedItems.map(transformToFeedVideo);
      send({ type: 'VIDEOS_LOADED', videos });
    }
  }, [feedItems, send]);
  
  // Helper functions for components
  const playVideo = (videoId: string) => {
    send({ type: 'USER_PLAY', videoId });
  };
  
  const pauseVideo = (videoId: string) => {
    send({ type: 'USER_PAUSE', videoId });
  };
  
  const getVideoActor = (videoId: string) => {
    return state.context.videoActors.get(videoId);
  };
  
  return {
    state,
    send,
    actor,
    videos: state.context.videos,
    activeVideoId: state.context.activeVideoId,
    isLoading,
    playVideo,
    pauseVideo,
    getVideoActor,
  };
}