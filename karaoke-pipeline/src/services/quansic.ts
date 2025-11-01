/**
 * Quansic API Service
 * Enriches recordings with ISWC via Akash-hosted Quansic service
 */

const QUANSIC_URL = process.env.QUANSIC_URL || process.env.QUANSIC_SERVICE_URL || 'http://d1crjmbvpla6lc3afdemo0mhgo.ingress.dhcloud.xyz';

export interface QuansicRecordingResult {
  success: boolean;
  data?: {
    isrc: string;
    title: string;
    iswc: string | null;
    work_title: string | null;
    artists: Array<{
      name: string;
      isni?: string;
      spotify_id?: string;
      apple_id?: string;
      musicbrainz_mbid?: string;
    }>;
    composers: Array<{
      name: string;
      isni?: string;
      ipi?: string;
      role?: string;
    }>;
    duration_ms?: number;
    q2_score?: number;
    platform_ids?: {
      spotify?: string;
      apple?: string;
      musicbrainz?: string;
      luminate?: string;
      gracenote?: string;
    };
  };
  error?: string;
  message?: string;
}

/**
 * Enrich recording by ISRC
 */
export async function enrichRecording(
  isrc: string,
  spotifyTrackId?: string,
  recordingMbid?: string
): Promise<QuansicRecordingResult> {
  try {
    const response = await fetch(`${QUANSIC_URL}/enrich-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isrc,
        spotify_track_id: spotifyTrackId,
        recording_mbid: recordingMbid,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || 'Quansic API request failed',
      };
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Quansic service',
    };
  }
}

/**
 * Check if Quansic service is healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${QUANSIC_URL}/health`);
    const result = await response.json();
    return result.status === 'healthy';
  } catch {
    return false;
  }
}
