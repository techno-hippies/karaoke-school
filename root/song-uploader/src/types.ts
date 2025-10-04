// Enhanced format with word-level timestamps
export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

export interface LineWithWords {
  lineIndex: number;
  segmentId?: string; // e.g., "verse-1", "chorus-1" (assigned from section markers)
  originalText: string;
  translations?: Record<string, string>; // { "cn": "中文", "vi": "Tiếng Việt" }
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface EnhancedSongMetadata {
  version: 2;
  title: string;
  artist: string;
  duration: number;
  format: "word-and-line-timestamps";

  // Line-level data with embedded word timestamps
  lines: LineWithWords[];

  // Available translation language codes
  availableLanguages: string[]; // ["en", "cn", "vi"]

  // Processing metadata
  generatedAt: string;
  elevenLabsProcessed: boolean;
  wordCount: number;
  lineCount: number;
}

// ElevenLabs API types
export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
}

export interface ElevenLabsResponse {
  words: ElevenLabsWord[];
}

export interface CachedAlignment {
  audioHash: string;
  lyricsHash: string;
  result: ElevenLabsResponse;
  timestamp: number;
}

// Song input files
export interface SongFiles {
  audio: File;  // Full song audio for Grove upload and playback
  voiceStems?: File;  // Isolated vocals for ElevenLabs processing
  lyrics?: File;  // Text file with lyrics
  metadata?: File;  // Generated metadata
  thumbnail?: File;
}

export interface UploadResult {
  songId: string;
  folderUri: string;
  audioUri: string;
  metadataUri: string;
  thumbnailUri?: string;
  coverUri?: string;
  musicVideoUri?: string;
}

// Song configuration (from metadata.json in song folder)
export interface SongConfig {
  id: string;                    // Slug: "heat-of-the-night-scarlett-x"
  geniusId?: number;            // Optional: Genius API song ID
  geniusArtistId?: number;      // Optional: Genius API artist ID
  title?: string;               // Override auto-detected title
  artist?: string;              // Override auto-detected artist
  duration?: number;            // Auto-calculated from audio
  segmentIds?: string[];        // Practice segments: ["verse-1", "chorus-1"]
  enabled?: boolean;            // Default: true
}
