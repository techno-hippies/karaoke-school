import type { GeniusSong } from './genius';

/**
 * Content Source Enumeration
 * Identifies how content is loaded and practiced
 *
 * Note: Native songs may have Genius IDs as metadata, but if they're practiced
 * with audio/timestamps from the contract, they're "Native" source.
 */
export enum ContentSource {
  Native = 0,    // Songs from SongRegistryV4 (audio + word-level timestamps)
  Genius = 1,    // Songs from Genius.com API (lyrics only, no audio)
}

/**
 * Content Identifier
 * Combines source and ID for unique identification
 */
export interface ContentIdentifier {
  source: ContentSource;
  id: string;
}

/**
 * Unified Song Interface
 * Supports both native and external sources
 */
export interface Song {
  id: string;              // Native: "heat-of-the-night-scarlett-x", Genius: "123456"
  source: ContentSource;
  title: string;
  artist: string;
  duration?: number;       // Optional (Genius songs have no audio)
  thumbnailUrl?: string;
  audioUrl?: string;       // Only for native songs

  // Source-specific data
  _registryData?: any;     // Native: RegistrySong from contract
  _geniusData?: GeniusSong; // Genius: Full Genius API data
}

/**
 * Word-level timestamp
 */
export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

/**
 * Line-level timestamp (with optional word-level)
 */
export interface LineTimestamp {
  start: number;
  end: number;
  text: string;
  originalText?: string;
  translatedText?: string;
  lineIndex?: number;
  wordCount?: number;
  words?: WordTimestamp[];
  [key: string]: unknown;
}

/**
 * Song metadata with full lyrics
 */
export interface SongMetadata extends Song {
  lineTimestamps: LineTimestamp[];
  totalLines: number;
}

/**
 * Timestamped Lyrics (Native songs with audio)
 */
export interface TimestampedLyrics {
  type: 'timestamped';
  lines: Array<{
    start: number;
    end: number;
    text: string;
    originalText?: string;
    translatedText?: string;
    words?: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  }>;
}

/**
 * Untimestamped Lyrics (Genius songs, no audio)
 */
export interface UntimestampedLyrics {
  type: 'untimestamped';
  lines: Array<{
    text: string;
    originalText?: string;
    translatedText?: string;
  }>;
}

/**
 * Unified lyrics type
 */
export type SegmentLyrics = TimestampedLyrics | UntimestampedLyrics;

/**
 * Unified Segment Interface
 * Replaces "Clip" - represents a practice unit from any source
 */
export interface Segment {
  id: string;                   // "verse-1" or "referent-5678"
  source: ContentSource;
  title: string;                // "Verse 1" or "Lines 1-4"
  artist: string;
  sectionType: string;          // "Verse", "Chorus", "Bridge", "Referent"
  sectionIndex?: number;        // Optional (native segments have this)

  // Content
  lyrics: SegmentLyrics;

  // Native-specific (optional)
  duration?: number;
  thumbnailUrl?: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  difficultyLevel?: number;
  wordsPerSecond?: number;

  // Genius-specific (optional)
  annotations?: any[];
  characterRange?: { start: number; end: number };
}

/**
 * Full segment metadata
 */
export interface SegmentMetadata extends Segment {
  totalLines: number;
  languages?: string[];
}

// ============================================================================
// DEPRECATED: Legacy types for backward compatibility
// Will be removed in future versions
// ============================================================================

/**
 * @deprecated Use Segment instead
 */
export interface Clip {
  id: string;
  title: string;
  artist: string;
  sectionType: string;        // "Verse", "Chorus", "Bridge", etc.
  sectionIndex: number;        // Which occurrence (0 = first)
  duration: number;            // in seconds (15-60s)
  thumbnailUrl?: string;
  audioUrl?: string;           // Vocals track
  instrumentalUrl?: string;    // Backing track for karaoke
  difficultyLevel: number;     // 1-5
  wordsPerSecond: number;      // Speaking pace (e.g., 1.1)
}

/**
 * @deprecated Use SegmentMetadata instead
 */
export interface ClipMetadata extends Clip {
  lineTimestamps: LineTimestamp[];
  totalLines: number;
  languages: string[];         // Language codes
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert ContentSource enum to URL path segment
 */
export function sourceToPath(source: ContentSource): string {
  return ContentSource[source].toLowerCase();
}

/**
 * Parse ContentSource from URL path segment
 */
export function pathToSource(path: string): ContentSource {
  const normalized = path.charAt(0).toUpperCase() + path.slice(1).toLowerCase();
  return ContentSource[normalized as keyof typeof ContentSource] ?? ContentSource.Native;
}

/**
 * Format content hash for contract calls
 * Contract V4 will use keccak256(source, id)
 */
export function formatContentHash(source: ContentSource, id: string): string {
  return `${source}:${id}`;
}

/**
 * Parse content hash back to source and ID
 */
export function parseContentHash(hash: string): ContentIdentifier {
  const [sourceStr, id] = hash.split(':');
  const source = parseInt(sourceStr) as ContentSource;
  return { source, id };
}

/**
 * Type guard: Check if lyrics are timestamped
 */
export function isTimestamped(lyrics: SegmentLyrics): lyrics is TimestampedLyrics {
  return lyrics.type === 'timestamped';
}

/**
 * Type guard: Check if lyrics are untimestamped
 */
export function isUntimestamped(lyrics: SegmentLyrics): lyrics is UntimestampedLyrics {
  return lyrics.type === 'untimestamped';
}
