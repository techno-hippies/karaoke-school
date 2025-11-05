/**
 * Story Protocol Metadata Schema
 *
 * Minimal metadata for TikTok creator derivative videos
 * Philosophy: Less is more - just mark as derivative, reference GRC-20, 18% creator
 */

export interface StoryDerivativeMetadata {
  // Basic info
  title: string;
  description?: string;

  // GRC-20 reference (source of truth for rights)
  grc20: {
    work_id: string;      // UUID from grc20_work_mints
    recording_id: string; // UUID from grc20_recording_mints
  };

  // Multilingual transcriptions (extensible)
  transcriptions: {
    [languageCode: string]: {
      text: string;
      detectedLanguage?: string;
      translationSource?: string;
    };
  };

  // Creator info (18% derivative rights)
  creators: [
    {
      name: string;
      address: string;              // Lens account address
      contributionPercent: 18;
      role: 'derivative_performer';
      description: string;
    }
  ];

  // Derivative relationship
  derivativeInfo: {
    type: 'cover_performance';
    originalWork: {
      title: string;
      artist: string;
      grc20WorkId: string;
    };
    revenuePolicy: string; // "18% creator derivative, 82% original rights holders"
  };

  // Media
  image: string;      // Thumbnail URL
  imageHash: string;
  mediaUrl: string;   // Video Grove URL
  mediaHash: string;
  mediaType: 'video/mp4';

  // Provenance
  provenance: {
    tiktok_video_id: string;
    tiktok_url?: string;
    spotify_track_id: string;
    genius_song_id: number;
    created_at: string;
  };

  ipType: 'Music';
}

/**
 * Build Story Protocol metadata for a TikTok derivative video
 */
export function buildStoryMetadata(params: {
  // Video data
  videoId: string;
  videoUrl?: string;
  groveVideoCid: string;
  groveVideoUrl: string;

  // Transcriptions (multilingual)
  transcriptions: {
    [lang: string]: { text: string; source?: string };
  };

  // Creator
  creatorName: string;
  creatorLensAddress: string;

  // Track data
  trackTitle: string;
  trackArtist: string;
  spotifyTrackId: string;
  geniusSongId: number;

  // GRC-20
  grc20WorkId: string;
  grc20RecordingId: string;

  // Optional thumbnail
  thumbnailUrl?: string;
  thumbnailCid?: string;
}): StoryDerivativeMetadata {

  const metadata: StoryDerivativeMetadata = {
    title: `${params.trackTitle} - TikTok Cover by ${params.creatorName}`,
    description: params.transcriptions.en?.text,

    grc20: {
      work_id: params.grc20WorkId,
      recording_id: params.grc20RecordingId,
    },

    transcriptions: params.transcriptions,

    creators: [
      {
        name: params.creatorName,
        address: params.creatorLensAddress,
        contributionPercent: 18,
        role: 'derivative_performer',
        description: 'TikTok creator performance',
      }
    ],

    derivativeInfo: {
      type: 'cover_performance',
      originalWork: {
        title: params.trackTitle,
        artist: params.trackArtist,
        grc20WorkId: params.grc20WorkId,
      },
      revenuePolicy: '18% creator derivative, 82% original rights holders',
    },

    image: params.thumbnailUrl || params.groveVideoUrl,
    imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO: Calculate
    mediaUrl: params.groveVideoUrl,
    mediaHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO: Calculate
    mediaType: 'video/mp4',

    provenance: {
      tiktok_video_id: params.videoId,
      tiktok_url: params.videoUrl,
      spotify_track_id: params.spotifyTrackId,
      genius_song_id: params.geniusSongId,
      created_at: new Date().toISOString(),
    },

    ipType: 'Music',
  };

  return metadata;
}

/**
 * Hash metadata for Story Protocol verification
 */
export function hashMetadata(metadata: StoryDerivativeMetadata): `0x${string}` {
  const crypto = require('crypto');
  const metadataJson = JSON.stringify(metadata);
  const hash = crypto.createHash('sha256').update(metadataJson).digest('hex');
  return `0x${hash}`;
}

/**
 * Hash a file from URL (for image/media verification)
 */
export async function hashUrl(url: string): Promise<`0x${string}`> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
    return `0x${hash}`;
  } catch (error: any) {
    console.warn(`⚠️  Failed to hash URL: ${error.message}`);
    // Fallback: hash the URL string
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    return `0x${hash}`;
  }
}
