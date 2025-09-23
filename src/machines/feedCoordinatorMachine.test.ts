import { createActor } from 'xstate';
import { feedCoordinatorMachine } from './feedCoordinatorMachine';

describe('feedCoordinatorMachine', () => {
  let actor: any;

  beforeEach(() => {
    actor = createActor(feedCoordinatorMachine);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  describe('Initial State', () => {
    it('should start in idle state with no active video', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle');
      expect(snapshot.context.activeVideoId).toBeNull();
      expect(snapshot.context.playbackMode).toBe('auto');
    });
  });

  describe('VIDEO_PLAY event', () => {
    it('should transition from idle to active when VIDEO_PLAY is sent', () => {
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      const snapshot = actor.getSnapshot();
      
      expect(snapshot.value).toBe('active');
      expect(snapshot.context.activeVideoId).toBe('video1');
      expect(snapshot.context.playbackMode).toBe('manual');
      expect(snapshot.context.videoStates.get('video1')).toBe('playing');
    });

    it('should pause all other videos when playing a new video', () => {
      // Play first video
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Play second video
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video2' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video2');
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
      expect(snapshot.context.videoStates.get('video2')).toBe('playing');
    });

    it('should set playbackMode to manual when user plays video', () => {
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.playbackMode).toBe('manual');
    });
  });

  describe('VIDEO_PAUSE event', () => {
    it('should pause the video and keep it as active', () => {
      // First play the video
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Then pause it
      actor.send({ type: 'VIDEO_PAUSE', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('active'); // Still active
      expect(snapshot.context.activeVideoId).toBe('video1'); // Still the active video
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
      expect(snapshot.context.playbackMode).toBe('manual');
    });
  });

  describe('VIDEO_ENTER_VIEWPORT event', () => {
    it('should set video as active and playing when entering viewport', () => {
      // Simulate user has already played a video (we're in active state)
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Now scroll to another video
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video2' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video2');
      expect(snapshot.context.videoStates.get('video2')).toBe('playing');
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
      expect(snapshot.context.playbackMode).toBe('auto');
    });

    it('should pause all other videos when entering viewport', () => {
      // Play video1
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Enter viewport for video2
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video2' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
      expect(snapshot.context.videoStates.get('video2')).toBe('playing');
    });

    it('should set video as active when entering viewport from idle', () => {
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle'); // Still idle, waiting for user interaction
      expect(snapshot.context.activeVideoId).toBe('video1');
    });
  });

  describe('VIDEO_LEAVE_VIEWPORT event', () => {
    it('should transition to idle when active video leaves viewport', () => {
      // Play a video
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Video leaves viewport
      actor.send({ type: 'VIDEO_LEAVE_VIEWPORT', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle');
      expect(snapshot.context.activeVideoId).toBeNull();
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
    });

    it('should not change state when non-active video leaves viewport', () => {
      // Play video1
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Different video leaves viewport
      actor.send({ type: 'VIDEO_LEAVE_VIEWPORT', videoId: 'video2' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('active');
      expect(snapshot.context.activeVideoId).toBe('video1');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle scrolling between videos correctly', () => {
      // User plays video1 (sets hasUserInteracted)
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      expect(actor.getSnapshot().context.videoStates.get('video1')).toBe('playing');
      expect(actor.getSnapshot().context.hasUserInteracted).toBe(true);
      
      // User scrolls to video2
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video2' });
      let snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video2');
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
      expect(snapshot.context.videoStates.get('video2')).toBe('playing');
      
      // User scrolls back to video1 
      // Video2 leaves viewport, machine goes to idle
      actor.send({ type: 'VIDEO_LEAVE_VIEWPORT', videoId: 'video2' });
      // Video1 enters viewport, should transition back to active since hasUserInteracted is true
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video1' });
      snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('active');
      expect(snapshot.context.activeVideoId).toBe('video1');
      expect(snapshot.context.videoStates.get('video1')).toBe('playing');
      expect(snapshot.context.videoStates.get('video2')).toBe('paused');
    });

    it('should maintain manual mode when user pauses then scrolls', () => {
      // User plays video1
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // User pauses video1
      actor.send({ type: 'VIDEO_PAUSE', videoId: 'video1' });
      expect(actor.getSnapshot().context.playbackMode).toBe('manual');
      
      // User scrolls to video2
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video2' });
      
      // Should switch to auto mode for scroll-triggered play
      expect(actor.getSnapshot().context.playbackMode).toBe('auto');
    });

    it('should handle rapid viewport changes', () => {
      // Simulate rapid scrolling
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      // Rapid viewport changes
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video2' });
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video3' });
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video1');
      expect(snapshot.context.videoStates.get('video1')).toBe('playing');
      expect(snapshot.context.videoStates.get('video2')).toBe('paused');
      expect(snapshot.context.videoStates.get('video3')).toBe('paused');
    });

    it('should not autoplay on first viewport enter from idle', () => {
      // Video enters viewport but user hasn't interacted yet
      actor.send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle'); // Still idle
      expect(snapshot.context.activeVideoId).toBe('video1');
      // Note: The video component checks initState before autoplaying
    });
  });

  describe('Edge Cases', () => {
    it('should handle VIDEO_PAUSE for non-active video', () => {
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      actor.send({ type: 'VIDEO_PAUSE', videoId: 'video2' }); // Different video
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video1');
      expect(snapshot.context.videoStates.get('video2')).toBe('paused');
    });

    it('should handle multiple VIDEO_PLAY events for same video', () => {
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video1');
      expect(snapshot.context.videoStates.get('video1')).toBe('playing');
    });

    it('should handle SCROLL_TO_VIDEO event', () => {
      actor.send({ type: 'VIDEO_PLAY', videoId: 'video1' });
      actor.send({ type: 'SCROLL_TO_VIDEO', videoId: 'video2' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.activeVideoId).toBe('video2');
      expect(snapshot.context.videoStates.get('video1')).toBe('paused');
    });
  });
});