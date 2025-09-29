export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  audioUrl?: string;
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