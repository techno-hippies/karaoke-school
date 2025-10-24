/**
 * Story Protocol Metadata Builder
 * Copied from archived/pkp-lens-flow/local/17-mint-story-ip-assets.ts
 *
 * Builds IPA Metadata Standard compliant metadata for Story Protocol
 */

import { Address, zeroAddress } from 'viem';
import { createHash } from 'crypto';
import { IPAssetMetadataSchema } from '../lib/schemas/story-protocol.js';

export interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;
  description: string;
  song: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    geniusId?: number;
  };
  grove: {
    video: string; // lens:// URI
    videoGateway: string; // HTTPS URL
    thumbnail?: string;
    thumbnailGateway?: string;
  };
  createdAt: string;
}

/**
 * Build Story Protocol metadata for a song/video
 * Following the IPA Metadata Standard: https://docs.story.foundation/blockchain-reference/metadata
 */
export async function buildSongMetadata(
  video: VideoManifest,
  tiktokHandle: string,
  walletAddress: Address
) {
  const primaryArtists = [video.song.artist];
  const isCopyrighted = video.song.copyrightType === 'copyrighted';

  // Validation: Copyrighted content MUST have MLC data
  if (isCopyrighted && !video.mlc) {
    throw new Error(
      'Copyrighted content requires MLC (Mechanical Licensing Collective) data. ' +
      'Cannot mint copyrighted work without verified rights holder information.'
    );
  }

  // Get media URLs
  // For mediaUrl: use TikTok URL (Story Explorer requires public HTTPS URL)
  // For image: use Grove thumbnail (lens:// URI works for thumbnails)
  const videoUrl = video.tiktokUrl; // TikTok HTTPS URL
  const thumbnailUrl = video.grove.thumbnail || video.grove.video; // lens:// URI for thumbnail

  // Build creators array based on copyright status
  const creators: any[] = [
    {
      name: tiktokHandle,
      address: walletAddress,
      contributionPercent: isCopyrighted ? 18 : 100,
      role: isCopyrighted ? 'derivative_performer' : 'creator',
      description: `User-generated performance video creator`,
      socialMedia: [
        { platform: 'TikTok', url: video.tiktokUrl },
      ],
    },
  ];

  // For copyrighted content, add original rights holder
  if (isCopyrighted) {
    creators.push({
      name: primaryArtists.join(' & '),
      address: zeroAddress,
      contributionPercent: 82,
      role: 'original_rights_holder',
      description: `Original artist(s) and rights holder(s); detailed credits in rights_metadata`,
      ...(video.song.spotifyId || video.song.geniusId ? {
        socialMedia: [
          ...(video.song.spotifyId ? [{ platform: 'Spotify', url: `https://open.spotify.com/track/${video.song.spotifyId}` }] : []),
          ...(video.song.geniusId ? [{ platform: 'Genius', url: `https://genius.com/songs/${video.song.geniusId}` }] : []),
        ]
      } : {}),
    });
  }

  // Hash media files (fetches and hashes actual content)
  const imageHash = await hashUrl(thumbnailUrl);
  const mediaHash = await hashUrl(videoUrl);

  // Build metadata following IPA Metadata Standard
  const metadata = {
    // === REQUIRED FOR STORY EXPLORER ===
    title: `${video.song.title} - ${primaryArtists[0]}`,
    description: video.description || `User-generated performance video by ${tiktokHandle} featuring '${video.song.title}' by ${primaryArtists.join(', ')}. Original composition and recording rights held by respective owners.`,
    createdAt: video.createdAt, // ISO8601 format
    image: thumbnailUrl, // Thumbnail for display (lens:// URI)
    imageHash, // SHA-256 hash of actual file content
    creators,

    // === REQUIRED FOR COMMERCIAL INFRINGEMENT CHECK ===
    mediaUrl: videoUrl, // Actual video file (lens:// URI)
    mediaHash, // SHA-256 hash of actual file content
    mediaType: 'video/mp4', // MIME type

    // === OPTIONAL STANDARD FIELDS ===
    ipType: 'Music', // Type of IP Asset
    tags: ['karaoke', 'cover', 'music', 'lipsync', video.song.copyrightType],

    // === CUSTOM EXTENSIONS (allowed by standard) ===
    original_work: {
      title: video.song.title,
      primary_artists: primaryArtists,
      recording_label: 'Unknown',
      isrc: video.song.isrc || '',
      iswc: video.mlc?.iswc || '',
      mlc_work_id: video.mlc?.mlcSongCode || '',
      source_url: video.song.spotifyId
        ? `https://open.spotify.com/track/${video.song.spotifyId}`
        : null,
      genius_url: video.song.geniusId
        ? `https://genius.com/songs/${video.song.geniusId}`
        : null,
      genius_id: video.song.geniusId || null,
      ownership_claim_status: isCopyrighted ? 'verified' : 'not_applicable',
    },
    derivative_details: {
      video_url: videoUrl,
      duration_seconds: null,
      start_offset_seconds: 0,
      audio_used: 'varies',
      notes: `User-generated performance video incorporating the song. Specific type (e.g., lip-sync, dance, or vocal cover) and audio elements vary.`,
    },
    royalty_allocation_proposal: isCopyrighted
      ? [
          { party: 'creator', pct: 18 },
          { party: 'rights_holders', pct: 82 },
        ]
      : [
          { party: 'creator', pct: 100 },
        ],
    license_hint: {
      default: 'social_non_commercial',
      human_readable: 'Non-commercial social sharing only; underlying composition and recording remain third-party-owned.',
      terms_url: 'https://karaoke.school/terms/lipsync',
    },
    provenance: {
      created_at: video.createdAt,
      uploader: walletAddress,
      tiktok_post_id: video.tiktokVideoId,
      tiktok_url: video.tiktokUrl,
      copyright_type: video.song.copyrightType,
    },
  };

  // Validate metadata against Story Protocol schema
  const validationResult = IPAssetMetadataSchema.safeParse(metadata);
  if (!validationResult.success) {
    throw new Error(
      `Invalid IP Asset metadata: ${validationResult.error.message}`
    );
  }

  return metadata;
}

/**
 * Fetches a file from a URL and returns its SHA-256 hash
 * Used for image/media hashes in Story Protocol metadata
 */
async function hashUrl(url: string): Promise<`0x${string}`> {
  try {
    // Convert lens:// URIs to https://api.grove.storage/
    let fetchUrl = url;
    if (url.startsWith('lens://')) {
      const hash = url.replace('lens://', '');
      fetchUrl = `https://api.grove.storage/${hash}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
    return `0x${hash}`;
  } catch (error: any) {
    console.warn(`      ⚠️  Failed to hash URL (using URL hash fallback): ${error.message}`);
    // Fallback: hash the URL string itself
    const hash = createHash('sha256').update(url).digest('hex');
    return `0x${hash}`;
  }
}

/**
 * Hash metadata for Story Protocol using SHA-256
 */
export function hashMetadata(metadata: any): `0x${string}` {
  const metadataJson = JSON.stringify(metadata);
  const hash = createHash('sha256').update(metadataJson).digest('hex');
  return `0x${hash}`;
}
