// Legacy format (for backward compatibility)
export interface LegacySongMetadata {
  title: string;
  artist: string;
  duration?: number;
  lineTimestamps: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  totalLines: number;
  format?: "line-level-timestamps";
}

// Enhanced format with word-level timestamps
export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

export interface LineWithWords {
  lineIndex: number;
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

// Union type for all metadata formats
export type SongMetadata = LegacySongMetadata | EnhancedSongMetadata;

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
export interface SongInputFiles {
  audio: File;
  lyrics: string;
  translation?: string;
}

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUri?: string;
  audioUri: string;
  timestampsUri: string;
  addedAt: string;
}

export interface SongRegistry {
  version: number;
  lastUpdated: string;
  songs: SongEntry[];
}

export interface UploadedResource {
  uri: string;
  gatewayUrl: string;
  storageKey: string;
}

export interface SongFiles {
  audio: File;  // Full song audio for Grove upload and playback
  voiceStems?: File;  // Isolated vocals for ElevenLabs processing
  lyrics?: File;  // Text file with lyrics
  translation?: File;  // Text file with translations
  metadata?: File;  // Generated metadata (for legacy support)
  thumbnail?: File;
}

export interface UploadResult {
  songId: string;
  folderUri: string;
  audioUri: string;
  metadataUri: string;
  thumbnailUri?: string;
}

// Clip-based types
export interface ClipSection {
  id: string; // "scarlett-verse-1"
  sectionType: string; // "Verse 1", "Chorus", "Bridge"
  sectionIndex: number; // 0 for first occurrence, 1 for second
  startTime: number; // Start time in full song
  endTime: number; // End time in full song
  duration: number; // Section duration
  lines: LineWithWords[]; // Only lines for this section
}

export interface ClipMetadata extends EnhancedSongMetadata {
  id: string;
  sectionType: string;
  sectionIndex: number;
  learningMetrics: {
    difficultyLevel: number;
    vocabularyCoverage: {
      top1kPercent: number;
      top5kPercent: number;
      uniqueWords: number;
      totalWords: number;
      difficultWords: string[];
    };
    pace: {
      wordsPerSecond: number;
      totalWords: number;
      classification: 'slow' | 'conversational' | 'fast' | 'very-fast';
    };
    pronunciation: {
      syllablesPerWord: number;
      totalSyllables: number;
      complexity: 'simple' | 'moderate' | 'complex';
    };
    analysis: {
      repeatedPhrases: string[];
      sentenceStructure: 'simple' | 'moderate' | 'complex';
      vocabularyLevel: string;
    };
  };
}

export interface ClipUploadResult {
  clipId: string;
  folderUri: string;
  audioUri: string;
  metadataUri: string;
  thumbnailUri?: string;
}

// Full song upload types
export interface FullSongUploadResult {
  songId: string;
  folderUri: string;
  audioUri: string;
  metadataUri: string;
  coverUri?: string;
  thumbnailUri?: string;
  musicVideoUri?: string;  // Optional: Link to music video on Grove
}