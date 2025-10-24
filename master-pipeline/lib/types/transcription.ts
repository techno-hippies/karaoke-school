/**
 * Transcription data structures for multilingual karaoke-style captions
 * Used for word-level timing and translations
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
    en: TranscriptionData; // English (from ElevenLabs)
    vi?: TranscriptionData; // Vietnamese (translated)
    zh?: TranscriptionData; // Mandarin (translated)
  };
  generatedAt: string; // ISO timestamp
  elevenLabsModel?: string; // e.g., "scribe_v1"
  translationModel?: string; // e.g., "gemini-2.5-flash-lite-preview-09-2025"
}
