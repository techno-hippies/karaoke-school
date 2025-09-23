// TEMPORARILY DISABLED - needs migration to Lit Protocol v8
// This module tracks video views using Lit Protocol
export class ViewTracker {
  constructor(config: any) {
    console.warn('[ViewTracker] Disabled - needs v8 migration');
  }
  
  async initialize(signer: any): Promise<void> {
    console.warn('[ViewTracker] Initialize called but disabled');
  }
  
  async startTracking(playbackId: string, videoId: string): Promise<void> {
    console.warn('[ViewTracker] Start tracking called but disabled');
  }
  
  async stopTracking(playbackId: string): Promise<void> {
    console.warn('[ViewTracker] Stop tracking called but disabled');
  }
  
  async pauseTracking(playbackId: string): Promise<void> {
    console.warn('[ViewTracker] Pause tracking called but disabled');
  }
  
  async resumeTracking(playbackId: string): Promise<void> {
    console.warn('[ViewTracker] Resume tracking called but disabled');
  }
  
  stopAllTracking(): void {
    console.warn('[ViewTracker] Stop all tracking called but disabled');
  }
}

export default ViewTracker;