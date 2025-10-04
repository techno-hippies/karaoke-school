#!/usr/bin/env bun

/**
 * Generates full-song karaoke metadata from ElevenLabs alignment + lyrics + translations
 * Creates metadata.json with word-level and line-level timestamps for entire song
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import type { ElevenLabsWord, LineWithWords } from '../types.js';

interface SectionMarker {
  type: string;
  lineIndex: number;
}

/**
 * Parse lyrics.txt and extract section markers
 * Returns lyrics lines and section positions
 */
export function parseLyricsWithSections(lyrics: string): {
  lines: string[];
  sections: SectionMarker[];
} {
  const allLines = lyrics.split('\n');
  const lyricLines: string[] = [];
  const sections: SectionMarker[] = [];
  let currentLineIndex = 0;

  for (const line of allLines) {
    const trimmed = line.trim();

    // Check for section marker like [Verse], [Chorus], etc.
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);

    if (sectionMatch) {
      sections.push({
        type: sectionMatch[1],
        lineIndex: currentLineIndex
      });
      // Keep the marker as a line too
      lyricLines.push(trimmed);
      currentLineIndex++;
    } else if (trimmed) {
      lyricLines.push(trimmed);
      currentLineIndex++;
    }
  }

  return { lines: lyricLines, sections };
}

/**
 * Load all translations from translations/ folder
 */
export async function loadTranslations(
  translationsDir: string
): Promise<Record<string, string[]>> {
  const translations: Record<string, string[]> = {};

  try {
    const files = await readdir(translationsDir);

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const langCode = file.replace('.txt', '');
        const filePath = join(translationsDir, file);
        const content = await Bun.file(filePath).text();
        const lines = content.split('\n').filter(line => line.trim());
        translations[langCode] = lines;
      }
    }
  } catch {
    // No translations folder - that's OK
  }

  return translations;
}

/**
 * Map ElevenLabs words to lyric lines
 * This is the same logic used by MetadataGenerator but adapted for full song
 */
export function mapWordsToLines(
  words: ElevenLabsWord[],
  lyricLines: string[],
  translations: Record<string, string[]>
): LineWithWords[] {
  const lines: LineWithWords[] = [];
  let wordIndex = 0;

  for (let lineIdx = 0; lineIdx < lyricLines.length; lineIdx++) {
    const lineText = lyricLines[lineIdx];

    // Check if this is a section marker
    if (lineText.match(/^\[.+\]$/)) {
      lines.push({
        lineIndex: lineIdx,
        originalText: lineText,
        start: 0,
        end: 0,
        words: [],
        sectionMarker: true,
      } as LineWithWords & { sectionMarker: boolean });
      continue;
    }

    // Split line into expected words (ignoring punctuation)
    const expectedWords = lineText
      .toLowerCase()
      .replace(/[^\w\s'-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const lineWords: ElevenLabsWord[] = [];
    let lineStart = Infinity;
    let lineEnd = 0;

    // Match expected words with ElevenLabs words
    for (let i = 0; i < expectedWords.length && wordIndex < words.length; i++) {
      const expected = expectedWords[i];
      const matchingWord = findMatchingWord(words, wordIndex, expected);

      if (matchingWord) {
        lineWords.push(matchingWord.word);
        wordIndex = matchingWord.nextIndex;

        if (matchingWord.word.start < lineStart) lineStart = matchingWord.word.start;
        if (matchingWord.word.end > lineEnd) lineEnd = matchingWord.word.end;
      }
    }

    // Build translations map for this line
    // Translation files have same structure as English (including section markers)
    const lineTranslations: Record<string, string> = {};
    for (const [lang, translationLines] of Object.entries(translations)) {
      if (lineIdx >= 0 && lineIdx < translationLines.length) {
        const translatedText = translationLines[lineIdx].trim();
        // Only add if not empty
        if (translatedText) {
          lineTranslations[lang] = translatedText;
        }
      }
    }

    lines.push({
      lineIndex: lineIdx,
      originalText: lineText,
      translations: Object.keys(lineTranslations).length > 0 ? lineTranslations : undefined,
      start: lineStart === Infinity ? 0 : lineStart,
      end: lineEnd || 0,
      words: lineWords.map(w => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    });
  }

  return lines;
}

/**
 * Find matching word in ElevenLabs output
 */
function findMatchingWord(
  words: ElevenLabsWord[],
  startIndex: number,
  expected: string
): { word: ElevenLabsWord; nextIndex: number } | null {
  const searchLimit = Math.min(startIndex + 10, words.length);

  for (let i = startIndex; i < searchLimit; i++) {
    const word = words[i];
    const wordText = word.text.toLowerCase().replace(/[^\w'-]/g, '');

    // Exact match
    if (wordText === expected) {
      return { word, nextIndex: i + 1 };
    }

    // Fuzzy match for words > 3 chars
    if (expected.length > 3 && wordText.length > 3) {
      if (wordText.startsWith(expected.slice(0, 3))) {
        return { word, nextIndex: i + 1 };
      }
    }
  }

  return null;
}

/**
 * Generate full-song metadata from alignment + lyrics + translations
 */
export async function generateFullSongMetadata(
  songId: string,
  songDir: string
): Promise<any> {
  // Load karaoke alignment (ElevenLabs output)
  const alignmentPath = join(songDir, 'karaoke-alignment.json');
  const alignmentData = await Bun.file(alignmentPath).json();
  const words: ElevenLabsWord[] = alignmentData.words;

  // Load lyrics with section markers
  const lyricsPath = join(songDir, 'lyrics.txt');
  const lyricsText = await Bun.file(lyricsPath).text();
  const { lines: lyricLines, sections } = parseLyricsWithSections(lyricsText);

  // Extract title and artist from folder name (format: "Artist - Title")
  const parts = songId.split(' - ');
  const artist = parts[0] || 'Unknown Artist';
  const title = parts.slice(1).join(' - ') || 'Unknown Title';

  // Load translations
  const translationsDir = join(songDir, 'translations');
  const translations = await loadTranslations(translationsDir);

  // Map words to lines
  const lines = mapWordsToLines(words, lyricLines, translations);

  // Calculate duration (last word end time)
  const duration = words.length > 0 ? words[words.length - 1].end : 0;

  // Count total words and lines (excluding section markers)
  const wordCount = lines.reduce((sum, line) => sum + line.words.length, 0);
  const lineCount = lines.filter(line => !(line as any).sectionMarker).length;

  // Build section index for quick navigation
  const sectionIndex = sections.map(section => {
    const line = lines[section.lineIndex];
    return {
      type: section.type,
      lineIndex: section.lineIndex,
      timestamp: line ? line.start : 0,
    };
  });

  return {
    version: 3,
    id: songId,
    title,
    artist,
    duration,
    format: 'word-and-line-timestamps',
    lines,
    availableLanguages: ['en', ...Object.keys(translations)],
    generatedAt: new Date().toISOString(),
    elevenLabsProcessed: true,
    wordCount,
    lineCount,
    sectionIndex,
  };
}
