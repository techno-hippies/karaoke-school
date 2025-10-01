import type {
  EnhancedSongMetadata,
  LineWithWords,
  WordTimestamp,
  ElevenLabsWord
} from '../types.js';

export class MetadataGenerator {
  private debugMode = true;

  private log(...args: any[]) {
    if (this.debugMode) {
      console.log('[METADATA]', ...args);
    }
  }

  /**
   * Check if two words are similar (for matching line words to ElevenLabs words)
   */
  private similarWords(word1: string, word2: string): boolean {
    // Simple similarity check
    if (word1.length < 3 || word2.length < 3) {
      return word1 === word2;
    }

    // Check if words start with same 3 characters
    return word1.substring(0, 3) === word2.substring(0, 3);
  }

  /**
   * Build word-to-line mapping (adapted from your KaraokeGenerator logic)
   */
  private buildWordLineMapping(
    elevenLabsWords: ElevenLabsWord[],
    lyricsLines: string[]
  ): Array<{ lineIndex: number; wordIndexes: number[] }> {

    // Filter out whitespace tokens from ElevenLabs response
    const actualWords = elevenLabsWords.filter(word => {
      const text = word.text;
      return text.trim() !== '' && !/^\s+$/.test(text);
    });

    this.log('Filtered ElevenLabs words (no whitespace):', actualWords.length);
    this.log('Total original words:', elevenLabsWords.length);

    // Create mapping of which ElevenLabs words belong to which line
    const mapping: Array<{ lineIndex: number; wordIndexes: number[] }> = [];
    let wordIndex = 0;

    for (let lineIndex = 0; lineIndex < lyricsLines.length; lineIndex++) {
      const lineText = lyricsLines[lineIndex].toLowerCase();
      const lineWords = lineText.split(' ').filter(w => w.trim());
      const wordIndexes: number[] = [];

      this.log(`Mapping line ${lineIndex}: "${lineText}" (${lineWords.length} words)`);

      // Try to match line words with ElevenLabs actual words
      for (let i = 0; i < lineWords.length && wordIndex < actualWords.length; i++) {
        const lineWord = lineWords[i];
        const elevenLabsWord = actualWords[wordIndex];

        // Simple matching - if the words are similar, map them
        if (elevenLabsWord && (
          elevenLabsWord.text.toLowerCase().includes(lineWord) ||
          lineWord.includes(elevenLabsWord.text.toLowerCase()) ||
          this.similarWords(lineWord, elevenLabsWord.text.toLowerCase())
        )) {
          // Find the original index in elevenLabsWords array
          const originalIndex = elevenLabsWords.findIndex(w =>
            w.text === elevenLabsWord.text && w.start === elevenLabsWord.start
          );
          wordIndexes.push(originalIndex);
          this.log(`  Mapped "${lineWord}" -> ElevenLabs word ${originalIndex}: "${elevenLabsWord.text}"`);
          wordIndex++;
        } else {
          // Skip this line word if no match found
          this.log(`  Could not match line word "${lineWord}" with ElevenLabs word "${elevenLabsWord?.text}"`);
        }
      }

      mapping.push({ lineIndex, wordIndexes });
    }

    return mapping;
  }

  /**
   * Generate enhanced metadata with word-level timestamps
   */
  generateEnhancedMetadata(
    elevenLabsWords: ElevenLabsWord[],
    lyricsLines: string[],
    translations: Record<string, string[]>, // { "cn": ["line1", "line2"], "vi": [...] }
    songTitle: string,
    artist: string
  ): EnhancedSongMetadata {

    this.log('Generating enhanced metadata...');
    this.log('ElevenLabs words:', elevenLabsWords.length);
    this.log('Lyric lines:', lyricsLines.length);
    this.log('Translations:', Object.keys(translations).join(', ') || 'none');

    // Build word-to-line mapping
    const wordLineMapping = this.buildWordLineMapping(elevenLabsWords, lyricsLines);

    // Convert to enhanced line format
    const lines: LineWithWords[] = wordLineMapping.map((lineMapping, lineIndex) => {
      const originalText = lyricsLines[lineIndex] || '';

      // Build translations object for this line
      const lineTranslations: Record<string, string> = {};
      for (const [langCode, translationLines] of Object.entries(translations)) {
        const translatedLine = translationLines[lineIndex];
        if (translatedLine && translatedLine.trim()) {
          lineTranslations[langCode] = translatedLine;
        }
      }

      // Get all words for this line
      const lineWords = lineMapping.wordIndexes
        .map(wordIndex => elevenLabsWords[wordIndex])
        .filter(word => word); // Remove any invalid mappings

      let startTime = 0;
      let endTime = 0;

      if (lineWords.length > 0) {
        startTime = Math.min(...lineWords.map(w => w.start));
        endTime = Math.max(...lineWords.map(w => w.end));
      }

      // Convert ElevenLabs words to WordTimestamp format
      const words: WordTimestamp[] = lineWords.map(word => ({
        text: word.text,
        start: word.start,
        end: word.end
      }));

      return {
        lineIndex,
        originalText,
        translations: Object.keys(lineTranslations).length > 0 ? lineTranslations : undefined,
        start: startTime,
        end: endTime,
        words
      };
    });

    // Calculate total duration
    const duration = lines.length > 0
      ? Math.max(...lines.map(line => line.end))
      : 0;

    // Calculate word count (total actual words, not including spaces)
    const wordCount = elevenLabsWords.filter(word => {
      const text = word.text;
      return text.trim() !== '' && !/^\s+$/.test(text);
    }).length;

    // Build list of available languages (original + translations)
    const availableLanguages = ['en', ...Object.keys(translations)];

    const metadata: EnhancedSongMetadata = {
      version: 2,
      title: songTitle,
      artist: artist,
      duration: Math.ceil(duration),
      format: "word-and-line-timestamps",
      lines,
      availableLanguages,
      generatedAt: new Date().toISOString(),
      elevenLabsProcessed: true,
      wordCount,
      lineCount: lines.length
    };

    this.log('Generated enhanced metadata:');
    this.log(`- Title: ${metadata.title}`);
    this.log(`- Artist: ${metadata.artist}`);
    this.log(`- Duration: ${metadata.duration}s`);
    this.log(`- Lines: ${metadata.lineCount}`);
    this.log(`- Words: ${metadata.wordCount}`);
    this.log(`- Languages: ${availableLanguages.join(', ')}`);

    return metadata;
  }

  /**
   * Extract basic song info from lyrics or use defaults
   */
  extractSongInfo(lyrics: string, filename?: string): { title: string; artist: string } {
    let title = 'Unknown Title';
    let artist = 'Unknown Artist';

    // Try to extract from filename if provided
    if (filename) {
      // Remove extension
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

      // Look for "Artist - Title" pattern
      const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
      if (dashMatch) {
        artist = dashMatch[1].trim();
        title = dashMatch[2].trim();
        return { title, artist };
      }

      // Use filename as title
      title = nameWithoutExt;
    }

    // Try to extract from lyrics (look for title in first few lines)
    const lines = lyrics.split('\n').slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('[')) {
        title = trimmed;
        break;
      }
    }

    return { title, artist };
  }

  /**
   * Validate enhanced metadata
   */
  validateMetadata(metadata: EnhancedSongMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.title || metadata.title === 'Unknown Title') {
      errors.push('Missing or default title');
    }

    if (!metadata.artist || metadata.artist === 'Unknown Artist') {
      errors.push('Missing or default artist');
    }

    if (metadata.lines.length === 0) {
      errors.push('No lines found');
    }

    if (metadata.wordCount === 0) {
      errors.push('No words found');
    }

    // Check for timing consistency
    for (const line of metadata.lines) {
      if (line.start >= line.end && line.words.length > 0) {
        errors.push(`Line ${line.lineIndex} has invalid timing`);
      }

      for (let i = 0; i < line.words.length - 1; i++) {
        const word = line.words[i];
        const nextWord = line.words[i + 1];
        if (word.start >= word.end) {
          errors.push(`Word "${word.text}" in line ${line.lineIndex} has invalid timing`);
        }
        if (word.end > nextWord.start) {
          this.log(`Warning: Overlapping words in line ${line.lineIndex}: "${word.text}" and "${nextWord.text}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}