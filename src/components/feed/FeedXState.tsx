import React from 'react';
import { useFeedMachine } from '../../hooks/useFeedMachine';
import { VideoPostXState } from './VideoPostXState';
import { ViewTrackerProvider } from '../../contexts/ViewTrackerProvider';

export function FeedXState() {
  const { 
    state, 
    videos, 
    activeVideoId,
    isLoading,
    playVideo,
    pauseVideo,
    getVideoActor
  } = useFeedMachine();
  
  if (isLoading && videos.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading videos...</p>
        </div>
      </div>
    );
  }
  
  if (videos.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <p className="text-xl mb-2">No videos available</p>
          <p className="text-neutral-400">Check back later for new content</p>
        </div>
      </div>
    );
  }
  
  return (
    <ViewTrackerProvider>
      <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        {videos.map(video => {
          const actor = getVideoActor(video.id);
          
          if (!actor) {
            console.error('[Feed] No actor for video:', video.id);
            return null;
          }
          
          return (
            <VideoPostXState
              key={video.id}
              videoId={video.id}
              actor={actor}
              isActive={activeVideoId === video.id}
              onPlay={() => playVideo(video.id)}
              onPause={() => pauseVideo(video.id)}
            />
          );
        })}
      </div>
    </ViewTrackerProvider>
  );
}