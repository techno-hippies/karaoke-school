/**
 * LRC Format Parser
 * Extracts duration from synced LRC lyrics
 */

/**
 * Parse LRC timestamp to milliseconds
 * Format: [MM:SS.xx] where MM = minutes, SS = seconds, xx = centiseconds
 * Example: [04:32.50] → 272500ms
 */
export function parseTimestamp(timestamp: string): number | null {
  const match = timestamp.match(/\[(\d+):(\d+)\.(\d+)\]/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const centiseconds = parseInt(match[3], 10);

  return minutes * 60 * 1000 + seconds * 1000 + centiseconds * 10;
}

/**
 * Extract duration from synced LRC lyrics
 * Finds the last timestamp in the LRC file
 * Returns duration in milliseconds or null if no timestamps found
 */
export function extractLrcDuration(syncedLrc: string): number | null {
  if (!syncedLrc) return null;

  // Find all timestamps: [MM:SS.xx]
  const timestamps = syncedLrc.match(/\[\d+:\d+\.\d+\]/g);
  if (!timestamps || timestamps.length === 0) return null;

  // Get the last timestamp (end of song)
  const lastTimestamp = timestamps[timestamps.length - 1];
  return parseTimestamp(lastTimestamp);
}

/**
 * Calculate duration match score
 * Compares LRC duration vs Spotify duration
 * Returns 0.0 to 1.0 (1.0 = perfect match, 0.0 = >30s difference)
 */
export function calculateDurationMatchScore(
  lrcDurationMs: number,
  spotifyDurationMs: number
): number {
  const diffMs = Math.abs(lrcDurationMs - spotifyDurationMs);
  const diffSeconds = diffMs / 1000;

  // Perfect match: 0-2 seconds difference
  if (diffSeconds <= 2) return 1.0;

  // Good match: 2-5 seconds
  if (diffSeconds <= 5) return 0.9;

  // Acceptable: 5-10 seconds
  if (diffSeconds <= 10) return 0.7;

  // Poor: 10-20 seconds (different version?)
  if (diffSeconds <= 20) return 0.4;

  // Bad: 20-30 seconds (likely wrong track)
  if (diffSeconds <= 30) return 0.2;

  // Terrible: >30 seconds (definitely wrong)
  return 0.0;
}
