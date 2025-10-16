/**
 * Transcription data structures for multilingual karaoke-style captions
 */

export interface TranscriptionWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence?: number;
}

export interface TranscriptionSegment {
  start: number; // seconds
  end: number; // seconds
  text: string; // segment text
  words: TranscriptionWord[];
}

export interface TranscriptionData {
  language: string; // ISO 639-1 code (en, vi, zh)
  text: string; // Full transcript
  segments: TranscriptionSegment[];
}

export interface VideoTranscription {
  languages: {
    en: TranscriptionData; // English (from Voxtral)
    vi?: TranscriptionData; // Vietnamese (from Gemini)
    zh?: TranscriptionData; // Mandarin (from Gemini)
  };
  generatedAt: string; // ISO timestamp
  voxtralModel?: string; // e.g., "voxtral-mini-latest"
  translationModel?: string; // e.g., "gemini-flash-2.5-lite"
}

/**
 * Extended video manifest with transcriptions
 */
export interface VideoWithTranscription {
  postId: string;
  postUrl: string;
  description: string;
  copyrightType: "copyrighted" | "copyright-free";
  localFiles?: {
    video?: string;
    thumbnail?: string;
  };
  transcription?: VideoTranscription;
  // ... other video fields
}
