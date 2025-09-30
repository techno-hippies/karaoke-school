/**
 * FSRS Card Generator Service
 * Generates spaced repetition cards from liked videos using contract registry data
 */

import { loadSongData } from '../lib/songs/loader';
import { getRegistrySongById } from '../lib/songs/grove-registry';
import type { EmbeddedKaraokeSegment, LineTimestamp, WordTimestamp } from '../types/feed';

export interface LikedVideoData {
  postId: string;
  username: string;
  description: string;
  timestamp: string;

  // Karaoke metadata for FSRS card creation
  songId?: string;
  songTitle?: string;
  lyricsUrl?: string;
  segmentStart?: number;
  segmentEnd?: number;
  karaokeSegment?: EmbeddedKaraokeSegment; // Embedded segment data
}

export interface ExerciseCard {
  id: string;
  registryId: string;
  fragmentId: string;
  fragment: string;
  songTitle: string;
  artistName?: string;
  context?: string;
  type: 'line' | 'phrase' | 'word';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: string;
  sourcePostId: string;
}

export class FSRSCardGenerator {
  /**
   * Generate FSRS cards from a liked video with embedded karaoke data
   */
  async generateCardsFromLikedVideo(likedVideo: LikedVideoData): Promise<ExerciseCard[]> {
    const cards: ExerciseCard[] = [];

    try {
      // Priority 1: Use embedded karaoke segment (fastest, most reliable)
      if (likedVideo.karaokeSegment) {
        console.log('[FSRSCardGenerator] Using embedded karaoke segment data');
        return this.generateCardsFromEmbeddedSegment(likedVideo.karaokeSegment, likedVideo);
      }

      // Priority 2: Use contract registry + segment data (reliable)
      if (likedVideo.songId && likedVideo.segmentStart !== undefined && likedVideo.segmentEnd !== undefined) {
        console.log('[FSRSCardGenerator] Using contract registry + segment data');
        return this.generateCardsFromRegistrySegment(likedVideo);
      }

      // Priority 3: Use lyrics URL (legacy fallback)
      if (likedVideo.lyricsUrl && likedVideo.segmentStart !== undefined && likedVideo.segmentEnd !== undefined) {
        console.log('[FSRSCardGenerator] Using legacy lyrics URL');
        return this.generateCardsFromLyricsUrl(likedVideo);
      }

      console.warn('[FSRSCardGenerator] No usable karaoke data found in liked video');
      return [];

    } catch (error) {
      console.error('[FSRSCardGenerator] Failed to generate cards:', error);
      return [];
    }
  }

  /**
   * Generate cards from embedded karaoke segment (most efficient)
   */
  private generateCardsFromEmbeddedSegment(
    karaokeSegment: EmbeddedKaraokeSegment,
    likedVideo: LikedVideoData
  ): ExerciseCard[] {
    const cards: ExerciseCard[] = [];

    console.log(`[FSRSCardGenerator] Processing ${karaokeSegment.lines.length} embedded lines`);

    for (const line of karaokeSegment.lines) {
      // Skip structural markers
      if (this.isStructuralMarker(line.originalText)) continue;

      // Create line-level card
      const lineCard = this.createLineCard(
        karaokeSegment.songId,
        line,
        karaokeSegment.songTitle,
        karaokeSegment.artist,
        likedVideo.postId,
        this.getLineContext(karaokeSegment.lines, line.lineIndex || 0)
      );
      cards.push(lineCard);

      // Create word/phrase-level cards if word data available
      if (line.words && line.words.length > 1) {
        const phraseCards = this.createPhraseCards(
          karaokeSegment.songId,
          line,
          karaokeSegment.songTitle,
          karaokeSegment.artist,
          likedVideo.postId
        );
        cards.push(...phraseCards);
      }
    }

    console.log(`[FSRSCardGenerator] Generated ${cards.length} cards from embedded segment`);
    return cards;
  }

  /**
   * Generate cards from contract registry + segment data
   */
  private async generateCardsFromRegistrySegment(likedVideo: LikedVideoData): Promise<ExerciseCard[]> {
    if (!likedVideo.songId || likedVideo.segmentStart === undefined || likedVideo.segmentEnd === undefined) {
      return [];
    }

    try {
      // Get song data from contract registry
      const registrySong = await getRegistrySongById(likedVideo.songId);
      if (!registrySong) {
        console.warn(`[FSRSCardGenerator] Song ${likedVideo.songId} not found in registry`);
        return [];
      }

      // Load full song lyrics data
      const songData = await loadSongData(likedVideo.songId);

      // Filter lines within the segment
      const segmentLines = this.filterLinesInSegment(
        songData.lineTimestamps,
        likedVideo.segmentStart,
        likedVideo.segmentEnd
      );

      console.log(`[FSRSCardGenerator] Found ${segmentLines.length} lines in segment ${likedVideo.segmentStart}-${likedVideo.segmentEnd}s`);

      const cards: ExerciseCard[] = [];

      for (const line of segmentLines) {
        if (this.isStructuralMarker(line.originalText || line.text)) continue;

        const lineCard = this.createLineCard(
          likedVideo.songId,
          line,
          likedVideo.songTitle || registrySong.title,
          registrySong.artist,
          likedVideo.postId,
          this.getLineContext(songData.lineTimestamps, line.lineIndex || 0)
        );
        cards.push(lineCard);

        // Create phrase cards if word data available
        if (line.words && line.words.length > 1) {
          const phraseCards = this.createPhraseCards(
            likedVideo.songId,
            line,
            likedVideo.songTitle || registrySong.title,
            registrySong.artist,
            likedVideo.postId
          );
          cards.push(...phraseCards);
        }
      }

      return cards;

    } catch (error) {
      console.error('[FSRSCardGenerator] Failed to generate cards from registry:', error);
      return [];
    }
  }

  /**
   * Generate cards from legacy lyrics URL (fallback)
   */
  private async generateCardsFromLyricsUrl(likedVideo: LikedVideoData): Promise<ExerciseCard[]> {
    if (!likedVideo.lyricsUrl || likedVideo.segmentStart === undefined || likedVideo.segmentEnd === undefined) {
      return [];
    }

    try {
      // Resolve lens:// URI to actual URL
      const lyricsUrl = likedVideo.lyricsUrl.startsWith('lens://')
        ? likedVideo.lyricsUrl.replace('lens://', 'https://api.grove.storage/')
        : likedVideo.lyricsUrl;

      const response = await fetch(lyricsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch lyrics: ${response.statusText}`);
      }

      const lyricsData = await response.json();
      const lines = lyricsData.lines || lyricsData.lineTimestamps || [];

      const segmentLines = this.filterLinesInSegment(
        lines,
        likedVideo.segmentStart,
        likedVideo.segmentEnd
      );

      const cards: ExerciseCard[] = [];

      for (const line of segmentLines) {
        if (this.isStructuralMarker(line.originalText || line.text)) continue;

        const lineCard = this.createLineCard(
          likedVideo.songId || 'legacy_' + btoa(likedVideo.lyricsUrl).substring(0, 12),
          line,
          likedVideo.songTitle || 'Unknown Song',
          'Unknown Artist',
          likedVideo.postId,
          this.getLineContext(lines, line.lineIndex || 0)
        );
        cards.push(lineCard);
      }

      return cards;

    } catch (error) {
      console.error('[FSRSCardGenerator] Failed to generate cards from lyrics URL:', error);
      return [];
    }
  }

  /**
   * Create a line-level exercise card
   */
  private createLineCard(
    songId: string,
    line: any,
    songTitle: string,
    artist?: string,
    sourcePostId?: string,
    context?: string
  ): ExerciseCard {
    const lineText = line.originalText || line.text || '';
    const fragmentId = this.generateFragmentId('line', line.lineIndex || 0, lineText);

    return {
      id: `${songId}_${fragmentId}`,
      registryId: songId,
      fragmentId,
      fragment: lineText,
      songTitle,
      artistName: artist,
      context,
      type: 'line',
      difficulty: this.assessDifficulty(lineText),
      createdAt: new Date().toISOString(),
      sourcePostId: sourcePostId || 'unknown'
    };
  }

  /**
   * Create phrase-level exercise cards from line with word data
   */
  private createPhraseCards(
    songId: string,
    line: any,
    songTitle: string,
    artist?: string,
    sourcePostId?: string
  ): ExerciseCard[] {
    if (!line.words || line.words.length <= 1) return [];

    const cards: ExerciseCard[] = [];
    const lineText = line.originalText || line.text || '';

    // Create 2-4 word phrases
    for (let i = 0; i < line.words.length - 1; i++) {
      for (let length = 2; length <= Math.min(4, line.words.length - i); length++) {
        const phraseWords = line.words.slice(i, i + length);
        const phraseText = phraseWords.map((w: any) => w.text).join(' ');

        // Skip very short or very long phrases
        if (phraseText.length < 3 || phraseText.length > 50) continue;

        const fragmentId = this.generateFragmentId('phrase', line.lineIndex || 0, phraseText, i, i + length - 1);

        cards.push({
          id: `${songId}_${fragmentId}`,
          registryId: songId,
          fragmentId,
          fragment: phraseText,
          songTitle,
          artistName: artist,
          context: lineText,
          type: 'phrase',
          difficulty: this.assessDifficulty(phraseText),
          createdAt: new Date().toISOString(),
          sourcePostId: sourcePostId || 'unknown'
        });
      }
    }

    return cards;
  }

  /**
   * Filter lines that appear within a time segment
   */
  private filterLinesInSegment(lines: any[], segmentStart: number, segmentEnd: number): any[] {
    return lines.filter(line => {
      const lineStart = line.start || 0;
      const lineEnd = line.end || lineStart + 5; // Default 5 second duration

      // Line overlaps with segment if it starts before segment ends and ends after segment starts
      return lineStart < segmentEnd && lineEnd > segmentStart;
    });
  }

  /**
   * Generate a unique fragment identifier
   */
  private generateFragmentId(
    type: 'line' | 'phrase' | 'word',
    lineIndex: number,
    text: string,
    wordStart?: number,
    wordEnd?: number
  ): string {
    const contentHash = btoa(text.substring(0, 20)).substring(0, 8);

    if (type === 'line') {
      return `line_${lineIndex}_${contentHash}`;
    } else if (type === 'phrase' && wordStart !== undefined && wordEnd !== undefined) {
      return `phrase_${lineIndex}_${wordStart}_${wordEnd}_${contentHash}`;
    } else {
      return `${type}_${lineIndex}_${contentHash}`;
    }
  }

  /**
   * Check if text is a structural marker like [Verse], (Chorus)
   */
  private isStructuralMarker(text: string): boolean {
    if (!text) return true;
    return /^\s*[\(\[].*[\)\]]\s*$/.test(text) || text.trim().length === 0;
  }

  /**
   * Get surrounding lines for context
   */
  private getLineContext(allLines: any[], currentLineIndex: number): string {
    const start = Math.max(0, currentLineIndex - 1);
    const end = Math.min(allLines.length, currentLineIndex + 2);

    return allLines
      .slice(start, end)
      .map(line => line.originalText || line.text)
      .filter(text => text && !this.isStructuralMarker(text))
      .join(' / ');
  }

  /**
   * Assess difficulty level based on text characteristics
   */
  private assessDifficulty(text: string): 'beginner' | 'intermediate' | 'advanced' {
    if (!text) return 'beginner';

    const wordCount = text.split(/\s+/).length;
    const avgWordLength = text.replace(/\s/g, '').length / wordCount;
    const hasComplexPunctuation = /[;:—""''…]/.test(text);
    const hasCommonWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/i.test(text);

    if (wordCount <= 3 && avgWordLength <= 4 && hasCommonWords) {
      return 'beginner';
    } else if (wordCount >= 8 || avgWordLength >= 6 || hasComplexPunctuation) {
      return 'advanced';
    } else {
      return 'intermediate';
    }
  }

  /**
   * Get statistics about generated cards
   */
  getCardStats(cards: ExerciseCard[]): {
    total: number;
    byType: Record<string, number>;
    byDifficulty: Record<string, number>;
    bySong: Record<string, number>;
  } {
    const stats = {
      total: cards.length,
      byType: { line: 0, phrase: 0, word: 0 },
      byDifficulty: { beginner: 0, intermediate: 0, advanced: 0 },
      bySong: {} as Record<string, number>
    };

    for (const card of cards) {
      stats.byType[card.type]++;
      stats.byDifficulty[card.difficulty]++;
      stats.bySong[card.songTitle] = (stats.bySong[card.songTitle] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
let cardGenerator: FSRSCardGenerator | null = null;

/**
 * Get the default card generator instance
 */
export function getCardGenerator(): FSRSCardGenerator {
  if (!cardGenerator) {
    cardGenerator = new FSRSCardGenerator();
  }
  return cardGenerator;
}

/**
 * Helper function to generate cards from a liked video
 */
export async function generateCardsFromVideo(likedVideo: LikedVideoData): Promise<ExerciseCard[]> {
  const generator = getCardGenerator();
  return generator.generateCardsFromLikedVideo(likedVideo);
}