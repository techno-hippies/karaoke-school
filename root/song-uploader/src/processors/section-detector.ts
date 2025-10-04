import type { EnhancedSongMetadata, ClipSection, LineWithWords } from '../types.js';

// Audio buffers (in seconds)
// Adds breathing room since ElevenLabs timing is exact to the word
const SECTION_START_BUFFER = 0.25;
const SECTION_END_BUFFER = 0.3;

/**
 * Detect section boundaries from metadata lines
 * Looks for markers like (Verse 1), [Chorus], (Pre-Chorus), etc.
 * Adds 0.25s buffer before each section start for natural feel
 */
export function detectSections(metadata: EnhancedSongMetadata): ClipSection[] {
  const sections: ClipSection[] = [];
  let currentSection: Partial<ClipSection> | null = null;

  // Track section type occurrences for indexing
  const sectionTypeCounts = new Map<string, number>();

  for (const line of metadata.lines) {
    // Check if line is a section marker
    const sectionMatch = line.originalText.match(/^\s*[\(\[]([^\)\]]+)[\)\]]\s*$/);

    if (sectionMatch) {
      // Save previous section if exists
      if (currentSection && currentSection.lines && currentSection.lines.length > 0) {
        sections.push(currentSection as ClipSection);
      }

      // Extract and normalize section type
      const rawSectionType = sectionMatch[1].trim();
      const normalizedType = normalizeSectionType(rawSectionType);

      // Get section index (how many times we've seen this type before)
      const currentIndex = sectionTypeCounts.get(normalizedType) || 0;
      sectionTypeCounts.set(normalizedType, currentIndex + 1);

      // Start new section WITHOUT startTime - we'll set it from first actual lyric line
      currentSection = {
        sectionType: normalizedType,
        sectionIndex: currentIndex,
        startTime: 0, // Will be set from first line
        lines: []
      };
    } else if (currentSection) {
      // Add line to current section
      currentSection.lines!.push(line);

      // Set section start time from first line (with buffer)
      if (currentSection.lines!.length === 1) {
        currentSection.startTime = Math.max(0, line.start - SECTION_START_BUFFER);
      }

      // Always update end time to last line (with end buffer)
      currentSection.endTime = line.end + SECTION_END_BUFFER;
    } else {
      // Line before first section marker - create intro section
      if (sections.length === 0) {
        currentSection = {
          sectionType: 'Intro',
          sectionIndex: 0,
          startTime: Math.max(0, line.start - SECTION_START_BUFFER),
          lines: [line],
          endTime: line.end + SECTION_END_BUFFER
        };
      }
    }
  }

  // Push final section
  if (currentSection && currentSection.lines && currentSection.lines.length > 0) {
    sections.push(currentSection as ClipSection);
  }

  // Trim sections that have long gaps at the end (e.g., instrumental breaks)
  for (const section of sections) {
    trimSectionEndGap(section);
  }

  // Generate IDs and calculate durations
  const songSlug = slugify(metadata.title);
  return sections.map(section => {
    const sectionSlug = slugify(section.sectionType);
    const id = section.sectionIndex === 0
      ? `${songSlug}-${sectionSlug}`
      : `${songSlug}-${sectionSlug}-${section.sectionIndex + 1}`;

    return {
      ...section,
      id,
      duration: section.endTime! - section.startTime
    };
  });
}

/**
 * Trim long gaps at the end of sections (e.g., instrumental breaks)
 * Detects when the last word in a section has an abnormally long duration
 * and truncates the section to a reasonable endpoint
 */
function trimSectionEndGap(section: Partial<ClipSection>): void {
  if (!section.lines || section.lines.length === 0) {
    return;
  }

  const lastLine = section.lines[section.lines.length - 1];
  if (!lastLine.words || lastLine.words.length === 0) {
    return;
  }

  const lastWord = lastLine.words[lastLine.words.length - 1];
  const lastWordDuration = lastWord.end - lastWord.start;

  // If the last word has an abnormally long duration (>5s), it likely includes
  // an instrumental gap or silence that shouldn't be part of the section
  const MAX_REASONABLE_WORD_DURATION = 5.0;

  if (lastWordDuration > MAX_REASONABLE_WORD_DURATION) {
    // Calculate average word duration in this line
    const lineDurations = lastLine.words.map(w => w.end - w.start);
    const avgDuration = lineDurations.reduce((a, b) => a + b, 0) / lineDurations.length;

    // Trim the last word to average duration + 1 second buffer + end buffer
    const trimmedWordEnd = lastWord.start + Math.min(avgDuration + 1.0, MAX_REASONABLE_WORD_DURATION) + SECTION_END_BUFFER;

    // Update the section end time
    section.endTime = trimmedWordEnd;

    // Note: We don't modify the word timestamps themselves, just the section boundary
    // The normalizeClipTimestamps function will handle timestamp adjustments
  }
}

/**
 * Normalize section type names
 * "Verse 1" -> "Verse 1"
 * "verse 1" -> "Verse 1"
 * "CHORUS" -> "Chorus"
 * "Pre-Chorus" -> "Pre-Chorus"
 * "Montuno/Bridge - Call and Response" -> "Bridge"
 */
function normalizeSectionType(raw: string): string {
  // Remove extra whitespace
  const cleaned = raw.trim();

  // Handle compound types - take first part
  if (cleaned.includes('/')) {
    return normalizeSectionType(cleaned.split('/')[0]);
  }

  // Remove metadata after dash
  if (cleaned.includes(' - ')) {
    return normalizeSectionType(cleaned.split(' - ')[0]);
  }

  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Create URL-safe slug from text
 * "Scarlett" -> "scarlett"
 * "Heat of the Night" -> "heat-of-the-night"
 * "Verse 1" -> "verse-1"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-');     // Remove duplicate hyphens
}

/**
 * Normalize timestamps for a clip section
 * Subtracts section start time so clip audio starts at 0.0
 */
export function normalizeClipTimestamps(lines: LineWithWords[], startTime: number): LineWithWords[] {
  return lines.map(line => ({
    ...line,
    start: line.start - startTime,
    end: line.end - startTime,
    words: line.words.map(word => ({
      ...word,
      start: word.start - startTime,
      end: word.end - startTime
    }))
  }));
}
