/**
 * Common types for feed items
 */

export interface FeedItem {
  id: string;
  type: 'video' | 'quiz';
  data: {
    videoUrl: string;
    username: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
    creatorHandle?: string;
    creatorId?: string;
    creatorAccountAddress?: string;
    thumbnailUrl?: string;
    thumbnailSourceUrl?: string;
    playCount?: number;
    musicTitle?: string;
    lensPostId?: string;
    userHasLiked?: boolean;
    // Karaoke-specific fields
    lyricsUrl?: string;
    lyricsFormat?: string;
    segmentStart?: number;
    segmentEnd?: number;
    // Quiz-specific fields
    showQuizAfter?: number;
    question?: string;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
    exerciseType?: string;
    megapotAmount?: number;
  };
}

// Lens Protocol v3 feed item interface
// Embedded karaoke segment data structure
export interface WordTimestamp {
  text: string;
  start: number; // Relative to video start (0-based)
  end: number;   // Relative to video start
}

export interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText?: string;
  start: number; // Relative to video start (0-based)
  end: number;   // Relative to video start
  wordCount: number;
  words?: WordTimestamp[];
}

export interface EmbeddedKaraokeSegment {
  songId: string;
  songTitle: string;
  artist?: string;

  // Timing info
  segmentStart: number; // Absolute time in full song
  segmentEnd: number;   // Absolute time in full song
  videoStart: number;   // Always 0 (video starts at segment start)
  videoEnd: number;     // Video duration

  // Embedded data (main usage)
  lines: LineTimestamp[]; // Only lines that appear in this segment

  // Reference data (future flexibility)
  fullSongTimestampsUri?: string; // lens:// URI to full song lyrics
  audioUri?: string;              // lens:// URI to full song audio
}

export interface LensFeedItem {
  id: string;
  creatorHandle: string;
  timestamp: string;
  data: {
    videoUrl: string;
    username: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
    userHasLiked?: boolean; // Add reaction state
    // Legacy karaoke fields (for backward compatibility)
    lyricsUrl?: string;
    lyricsFormat?: string;
    segmentStart?: number;
    segmentEnd?: number;
    songTitle?: string;
    // New embedded karaoke data
    karaokeSegment?: EmbeddedKaraokeSegment;
  };
  video: {
    id: string;
    uploadTxId: string;
    creator?: {
      id: string;
    };
  };
}