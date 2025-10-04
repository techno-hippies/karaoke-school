/**
 * @deprecated This service is obsolete. Trending writes now happen automatically in Lit Actions.
 *
 * Trending Queue Service (OBSOLETE - kept for reference)
 *
 * ⚠️ DO NOT USE - Trending writes are now handled automatically by Lit Actions:
 * - When a user clicks a Genius song, the referents.js Lit Action automatically writes to TrendingTrackerV1
 * - When a user records karaoke, the karaoke-scorer-v3.js Lit Action writes to the contract
 * - No manual tracking or syncing needed
 *
 * OLD Pattern (no longer used):
 * 1. User interactions stored in localStorage immediately (no delay)
 * 2. Background sync every 5-10 minutes via Lit Action
 * 3. PKP submits batched events to contract
 * 4. Queue cleared after successful sync
 *
 * See: lit-actions/src/search/referents.js for current implementation
 */

import { ContentSource } from '../types/song';

// Lit client type - using v8 pattern
type LitClient = any; // Lit v8 client from createLitClient()

export const TimeWindow = {
  Hourly: 0,
  Daily: 1,
  Weekly: 2
} as const;

export type TimeWindow = typeof TimeWindow[keyof typeof TimeWindow];

export type EventType = 'click' | 'play' | 'completion';

export interface TrendingEvent {
  source: ContentSource;
  songId: string;
  eventType: EventType;
  timestamp: number;
}

export interface TrendingQueueStats {
  totalEvents: number;
  clicks: number;
  plays: number;
  completions: number;
  oldestEvent: number | null;
  newestEvent: number | null;
}

const QUEUE_KEY = 'trending_event_queue';
const LAST_SYNC_KEY = 'trending_last_sync';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_QUEUE_SIZE = 1000; // Prevent memory issues
const MAX_BATCH_SIZE = 100; // Contract limit

/**
 * Track a click event (search result selected)
 */
export function trackClick(source: ContentSource, songId: string): void {
  queueEvent({
    source,
    songId,
    eventType: 'click',
    timestamp: Date.now()
  });
}

/**
 * Track a play event (audio preview started)
 */
export function trackPlay(source: ContentSource, songId: string): void {
  queueEvent({
    source,
    songId,
    eventType: 'play',
    timestamp: Date.now()
  });
}

/**
 * Track a completion event (song/segment fully completed)
 */
export function trackCompletion(source: ContentSource, songId: string): void {
  queueEvent({
    source,
    songId,
    eventType: 'completion',
    timestamp: Date.now()
  });
}

/**
 * Add event to local queue
 */
function queueEvent(event: TrendingEvent): void {
  try {
    const queue = getQueue();

    // Prevent queue from growing too large
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn('[TrendingQueue] Queue full, removing oldest events');
      queue.splice(0, 100); // Remove oldest 100 events
    }

    queue.push(event);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    console.log(`[TrendingQueue] Queued ${event.eventType} for ${event.songId} (queue size: ${queue.length})`);
  } catch (error) {
    console.error('[TrendingQueue] Failed to queue event:', error);
  }
}

/**
 * Get current queue from localStorage
 */
export function getQueue(): TrendingEvent[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[TrendingQueue] Failed to read queue:', error);
    return [];
  }
}

/**
 * Clear queue (after successful sync)
 */
function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
  console.log('[TrendingQueue] Queue cleared');
}

/**
 * Get queue statistics
 */
export function getQueueStats(): TrendingQueueStats {
  const queue = getQueue();

  const stats: TrendingQueueStats = {
    totalEvents: queue.length,
    clicks: 0,
    plays: 0,
    completions: 0,
    oldestEvent: null,
    newestEvent: null
  };

  if (queue.length === 0) return stats;

  queue.forEach(event => {
    if (event.eventType === 'click') stats.clicks++;
    if (event.eventType === 'play') stats.plays++;
    if (event.eventType === 'completion') stats.completions++;

    if (stats.oldestEvent === null || event.timestamp < stats.oldestEvent) {
      stats.oldestEvent = event.timestamp;
    }
    if (stats.newestEvent === null || event.timestamp > stats.newestEvent) {
      stats.newestEvent = event.timestamp;
    }
  });

  return stats;
}

/**
 * Sync queue to contract via Lit Action
 */
export async function syncQueue(
  litClient: LitClient,
  pkpPublicKey: string,
  timeWindow: TimeWindow = TimeWindow.Hourly,
  litActionCode: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const queue = getQueue();

  if (queue.length === 0) {
    console.log('[TrendingQueue] No events to sync');
    return { success: true };
  }

  try {
    console.log(`[TrendingQueue] Syncing ${queue.length} events...`);

    // Split into batches if needed
    const batches = [];
    for (let i = 0; i < queue.length; i += MAX_BATCH_SIZE) {
      batches.push(queue.slice(i, i + MAX_BATCH_SIZE));
    }

    console.log(`[TrendingQueue] Split into ${batches.length} batch(es)`);

    // Process each batch
    const results = [];
    for (const batch of batches) {
      const result = await litClient.executeJs({
        code: litActionCode,
        jsParams: {
          events: batch,
          timeWindow,
          pkpPublicKey,
          sessionId: crypto.randomUUID(),
        },
      });

      const response = JSON.parse(result.response);
      results.push(response);

      if (!response.success) {
        console.error('[TrendingQueue] Batch sync failed:', response.error);
        return { success: false, error: response.error };
      }
    }

    // Clear queue on success
    clearQueue();
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    const txHashes = results.map(r => r.txHash).filter(Boolean);
    console.log(`[TrendingQueue] Sync complete. TxHashes:`, txHashes);

    return {
      success: true,
      txHash: txHashes[0] // Return first tx hash
    };

  } catch (error) {
    console.error('[TrendingQueue] Sync failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Start automatic background sync
 */
export function startAutoSync(
  litClient: LitClient,
  pkpPublicKey: string,
  litActionCode: string,
  timeWindow: TimeWindow = TimeWindow.Hourly
): { stop: () => void } {
  console.log('[TrendingQueue] Starting auto-sync (every 5 minutes)');

  // Sync immediately if queue has events
  const initialQueue = getQueue();
  if (initialQueue.length > 0) {
    console.log(`[TrendingQueue] Initial sync: ${initialQueue.length} queued events`);
    syncQueue(litClient, pkpPublicKey, timeWindow, litActionCode);
  }

  // Set up interval
  const intervalId = setInterval(() => {
    const queue = getQueue();
    if (queue.length > 0) {
      console.log(`[TrendingQueue] Auto-sync: ${queue.length} queued events`);
      syncQueue(litClient, pkpPublicKey, timeWindow, litActionCode);
    }
  }, SYNC_INTERVAL);

  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('[TrendingQueue] Auto-sync stopped');
    }
  };
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): number | null {
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);
  return lastSync ? parseInt(lastSync) : null;
}

/**
 * Check if sync is needed (based on queue size or time)
 */
export function needsSync(maxQueueSize = 50, maxAge = SYNC_INTERVAL): boolean {
  const queue = getQueue();
  const stats = getQueueStats();

  // Sync if queue is large
  if (queue.length >= maxQueueSize) {
    return true;
  }

  // Sync if oldest event is too old
  if (stats.oldestEvent && (Date.now() - stats.oldestEvent) >= maxAge) {
    return true;
  }

  return false;
}
