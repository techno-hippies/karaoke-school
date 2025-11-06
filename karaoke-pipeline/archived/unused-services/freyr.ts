/**
 * Freyr Service API Wrapper
 * Downloads high-quality audio from Spotify using freyr + yt-dlp
 * Service running at: pip62i16mda1p6tb9862c951qs.ingress.d3akash.cloud
 */

const FREYR_SERVICE_URL = 'http://pip62i16mda1p6tb9862c951qs.ingress.d3akash.cloud';

export interface FreyrDownloadResponse {
  success: boolean;
  cached: boolean;
  audio_base64: string;
  file_size: number;
  format: string; // 'm4a'
  download_time_seconds?: number;
  error?: string;
}

export interface FreyrSegmentResponse {
  success: boolean;
  cached: boolean;
  segment_base64: string;
  file_size: number;
  format: string;
  segment_duration_ms: number;
  original_duration_ms: number;
  error?: string;
}

/**
 * Download full audio track from Spotify
 * Returns base64 encoded m4a audio (320kbps)
 */
export async function downloadAudio(params: {
  spotify_track_id: string;
  track_title?: string;
  artist?: string;
}): Promise<FreyrDownloadResponse> {
  try {
    const url = `${FREYR_SERVICE_URL}/download`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spotify_track_id: params.spotify_track_id,
        track_title: params.track_title,
        artist: params.artist,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Freyr API error (${response.status}): ${errorText}`);
    }

    const data: FreyrDownloadResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Download failed');
    }

    return data;
  } catch (error: any) {
    console.error(`Freyr download failed:`, error.message);
    throw error;
  }
}

/**
 * Download and segment audio track (for karaoke segments)
 * Returns base64 encoded m4a segment
 */
export async function downloadSegment(params: {
  spotify_track_id: string;
  start_ms: number;
  end_ms: number;
}): Promise<FreyrSegmentResponse> {
  try {
    const url = `${FREYR_SERVICE_URL}/segment`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spotify_track_id: params.spotify_track_id,
        start_ms: params.start_ms,
        end_ms: params.end_ms,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Freyr API error (${response.status}): ${errorText}`);
    }

    const data: FreyrSegmentResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Segment download failed');
    }

    return data;
  } catch (error: any) {
    console.error(`Freyr segment download failed:`, error.message);
    throw error;
  }
}

/**
 * Decode base64 audio to Buffer
 * Useful for saving to disk or uploading to IPFS
 */
export function decodeAudio(base64Audio: string): Buffer {
  return Buffer.from(base64Audio, 'base64');
}

/**
 * Calculate download metrics
 */
export function calculateMetrics(response: FreyrDownloadResponse | FreyrSegmentResponse): {
  fileSizeMB: number;
  cached: boolean;
  downloadTimeSeconds: number | null;
} {
  const fileSizeMB = Math.round((response.file_size / (1024 * 1024)) * 100) / 100;
  const downloadTimeSeconds = 'download_time_seconds' in response
    ? response.download_time_seconds || null
    : null;

  return {
    fileSizeMB,
    cached: response.cached,
    downloadTimeSeconds,
  };
}
