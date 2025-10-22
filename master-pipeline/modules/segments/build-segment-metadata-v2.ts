/**
 * Build Segment Metadata v2
 *
 * Creates segment metadata with:
 * - Line-level lyrics from LRCLib (for frontend display)
 * - Word-level lyrics from ElevenLabs (for karaoke timing)
 * - Mutable alignment on Grove (PKP can add translations)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { SegmentAlignmentMetadata } from '../../lib/schemas/segment-v2.js';
import { validateSegmentAlignmentMetadata } from '../../lib/schemas/segment-v2.js';
import {
  parseLRCLibLines,
  buildSegmentLyrics,
} from '../../lib/segment-lyrics-helpers.js';
import { LRCLibService } from '../../services/lrclib.js';

export interface BuildMetadataOptions {
  geniusId: number;
  segmentHash: string;
  tiktokMusicId: string;
  matchResult: any; // From AudioMatchingService
}

/**
 * Build complete segment alignment metadata v2
 *
 * @param options Build options with match result
 * @returns Segment metadata with lines + words
 */
export async function buildSegmentMetadataV2(options: BuildMetadataOptions): Promise<SegmentAlignmentMetadata> {
  const { geniusId, segmentHash, tiktokMusicId, matchResult } = options;

  // Check if we have the necessary data
  if (!matchResult.lrcMatch) {
    throw new Error('Match result missing lrcMatch data');
  }

  if (!matchResult.fullAlignment || matchResult.fullAlignment.length === 0) {
    throw new Error('Match result missing fullAlignment data from ElevenLabs');
  }

  // Get LRCLib synced lyrics from match result
  // (Song metadata only stores LRCLib ID for copyright reasons)
  let lrcLibSyncedLyrics: string;

  if (matchResult.lrcMatch?.syncedLyrics) {
    // Use synced lyrics from match result (already fetched during matching)
    lrcLibSyncedLyrics = matchResult.lrcMatch.syncedLyrics;
  } else if (matchResult.lrcMatch?.id) {
    // Fetch synced lyrics from LRCLib using the ID
    console.log(`  Fetching synced lyrics from LRCLib (ID: ${matchResult.lrcMatch.id})...`);
    const lrcLibService = new LRCLibService();
    const lrcLibResult = await lrcLibService.getById(matchResult.lrcMatch.id);
    lrcLibSyncedLyrics = lrcLibResult.syncedLyrics;
  } else {
    throw new Error('No LRCLib synced lyrics found in match result');
  }

  // Build English lyrics with both lines (LRCLib) and words (ElevenLabs)
  // Use Gemini's word indices (not timestamps!)
  const englishLyrics = buildSegmentLyrics(
    lrcLibSyncedLyrics,
    matchResult.fullAlignment,
    matchResult.startIdx,
    matchResult.endIdx
  );

  // Build metadata object
  const metadata: SegmentAlignmentMetadata = {
    version: '2.0.0',
    geniusId,
    segmentHash,
    tiktokMusicId,

    timeRange: {
      startTime: matchResult.startTime,
      endTime: matchResult.endTime,
      duration: matchResult.duration,
    },

    lyrics: {
      languages: {
        en: englishLyrics,
      },
      lrclib: {
        id: matchResult.lrcMatch.id,
        source: 'lrclib',
      },
    },

    createdAt: new Date().toISOString(),
  };

  // Validate before returning
  return validateSegmentAlignmentMetadata(metadata);
}

/**
 * Add backend translations to metadata (vi + zh by default)
 *
 * @param metadata Base metadata (English only)
 * @param translations Map of language code -> translated lyrics
 * @returns Updated metadata with translations
 */
export function addBackendTranslations(
  metadata: SegmentAlignmentMetadata,
  translations: Map<string, any> // Map<languageCode, SegmentLyrics>
): SegmentAlignmentMetadata {
  // Add each translation
  for (const [langCode, lyrics] of translations.entries()) {
    metadata.lyrics.languages[langCode] = lyrics;
  }

  // Track which languages came from backend
  metadata.translationMeta = {
    backend: Array.from(translations.keys()),
  };

  metadata.updatedAt = new Date().toISOString();

  return validateSegmentAlignmentMetadata(metadata);
}
