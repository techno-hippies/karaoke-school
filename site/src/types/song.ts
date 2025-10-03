export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  audioUrl?: string;
  _registryData?: any; // Internal: stores RegistrySong data from contract
}

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

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

export interface SongMetadata extends Song {
  lineTimestamps: LineTimestamp[];
  totalLines: number;
}

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

export interface ClipMetadata extends Clip {
  lineTimestamps: LineTimestamp[];
  totalLines: number;
  languages: string[];         // Language codes
}