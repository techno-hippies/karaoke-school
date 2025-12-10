/**
 * Lyrics Parser
 *
 * Parse and validate en-lyrics.txt and zh-lyrics.txt files.
 * Ensures line counts match and section markers align.
 * Detects censored profanity that would break karaoke grading.
 */

import type {
  ParsedLyrics,
  ParsedLine,
  SectionMarker,
  LyricsValidationResult,
} from '../types';

// Section marker pattern: [Intro], [Verse 1], [Chorus], [Bridge], etc.
const SECTION_MARKER_REGEX = /^\[([^\]]+)\]$/;

// ============================================================================
// PROFANITY CENSORSHIP DETECTION
// ============================================================================

/**
 * Common profanity roots that may be censored in lyrics.
 * These are the base words - we detect various censoring patterns.
 */
const PROFANITY_ROOTS = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell',
  'nigga', 'nigger', 'cunt', 'cock', 'dick', 'pussy',
  'whore', 'slut', 'fag', 'faggot', 'bastard', 'piss',
  'crap', 'bollocks', 'wanker', 'twat',
];

/**
 * Censorship characters - dashes, asterisks, em-dash, en-dash
 */
const CENSOR_CHARS = '[\\-–—\\*]+';

/**
 * Build regex patterns for detecting censored versions of profanity.
 *
 * For a word like "shit", detects:
 * - sh-t, sh--t, sh*t, sh**t, sh–t, sh—t (middle censored)
 * - sh-, sh–, sh— (trailing censored)
 * - s-h-i-t (spelled out with hyphens)
 */
function buildCensorPatterns(): { pattern: RegExp; description: string }[] {
  const patterns: { pattern: RegExp; description: string }[] = [];

  // Spelled out patterns first (longer, more specific)
  // e.g., n-a-s-t-y, s-h-i-t, f-u-c-k
  for (const word of PROFANITY_ROOTS) {
    if (word.length >= 4) {
      const spelledOut = word.split('').join('-');
      patterns.push({
        pattern: new RegExp(`\\b${spelledOut}\\b`, 'gi'),
        description: `spelled-out ${word}`,
      });
    }
  }

  // Common explicit censored patterns
  // These are hand-crafted for accuracy
  const explicitPatterns: [RegExp, string][] = [
    // shit variants
    [/\bsh[\-–—\*]+t\b/gi, 'sh*t'],
    [/\bsh[\-–—\*]+\s/gi, 'sh– (trailing)'],
    [/\bsh[\-–—\*]+$/gi, 'sh– (end of line)'],

    // fuck variants
    [/\bf[\-–—\*]+ck\b/gi, 'f*ck'],
    [/\bf[\-–—\*]+k\b/gi, 'f*k'],
    [/\bf[\-–—\*]+\s/gi, 'f– (trailing)'],

    // bitch variants
    [/\bb[\-–—\*]+tch\b/gi, 'b*tch'],
    [/\bb[\-–—\*]+ch\b/gi, 'b*ch'],

    // ass variants
    [/\ba[\-–—\*]+s\b/gi, 'a*s'],

    // Standalone trailing censored (often bitch/ass at end of phrase)
    [/\ba[\-–—],/gi, 'a– (censored word)'],
    [/\ba[\-–—]\s/gi, 'a– (censored word)'],
    [/\ba[\-–—]$/gi, 'a– (censored word)'],

    // nigga/nigger variants
    [/\bn[\-–—\*]+a\b/gi, 'n*a'],
    [/\bn[\-–—\*]+er\b/gi, 'n*er'],
    [/\bn[\-–—\*]+ga\b/gi, 'n*ga'],

    // damn variants
    [/\bd[\-–—\*]+mn\b/gi, 'd*mn'],
    [/\bd[\-–—\*]+m\b/gi, 'd*m'],

    // cunt variants
    [/\bc[\-–—\*]+nt\b/gi, 'c*nt'],

    // dick/cock variants
    [/\bd[\-–—\*]+ck\b/gi, 'd*ck'],
    [/\bc[\-–—\*]+ck\b/gi, 'c*ck'],

    // pussy variants
    [/\bp[\-–—\*]+ssy\b/gi, 'p*ssy'],
  ];

  for (const [pattern, desc] of explicitPatterns) {
    patterns.push({ pattern, description: desc });
  }

  return patterns;
}

const CENSOR_PATTERNS = buildCensorPatterns();

export interface CensoredWordIssue {
  lineIndex: number;
  text: string;
  matches: string[];
}

/**
 * Common words that are spelled out stylistically (not profanity).
 * These still cause grading issues and should be detected.
 */
const SPELLED_OUT_WORDS = [
  'nasty',   // n-a-s-t-y (Beyoncé)
  'crazy',   // c-r-a-z-y
  'sexy',    // s-e-x-y
  'money',   // m-o-n-e-y
  'honey',   // h-o-n-e-y
  'baby',    // b-a-b-y
];

/**
 * Detect censored profanity in a lyric line.
 * Returns array of descriptions for matched censored patterns, or empty if clean.
 */
export function detectCensoredWords(text: string): string[] {
  const matches: string[] = [];

  // First check for spelled-out non-profanity words (higher priority)
  for (const word of SPELLED_OUT_WORDS) {
    const spelledOut = word.split('').join('-');
    const pattern = new RegExp(`\\b${spelledOut}\\b`, 'gi');
    if (pattern.test(text)) {
      matches.push(`spelled-out "${word}" (should be "${word}")`);
    }
  }

  // If we found spelled-out words, those explain the issue - skip sub-pattern checks
  // to avoid confusing "a*s" matches on "n-a-s-t-y"
  if (matches.length > 0) {
    return matches;
  }

  // Check censorship patterns
  for (const { pattern, description } of CENSOR_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      matches.push(description);
    }
  }

  // Dedupe
  return [...new Set(matches)];
}

/**
 * Validate an array of lyric lines for censored profanity.
 * Returns issues found, or empty array if all clean.
 */
export function validateLyricsForCensorship(lines: string[]): CensoredWordIssue[] {
  const issues: CensoredWordIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const matches = detectCensoredWords(lines[i]);
    if (matches.length > 0) {
      issues.push({
        lineIndex: i,
        text: lines[i],
        matches,
      });
    }
  }

  return issues;
}

/**
 * Format censorship issues for CLI output
 */
export function formatCensorshipErrors(issues: CensoredWordIssue[]): string {
  const lines = [
    '❌ Censored profanity detected in lyrics',
    '',
    'The following lines contain censored words that will break karaoke grading:',
    '',
  ];

  for (const issue of issues) {
    lines.push(`  Line ${issue.lineIndex}: "${issue.text}"`);
    lines.push(`    Detected: ${issue.matches.join(', ')}`);
  }

  lines.push('');
  lines.push('Fix: Replace censored words with their uncensored forms.');
  lines.push('Example: "sh–t" → "shit", "a–" → "bitch"');

  return lines.join('\n');
}

/**
 * Parse a lyrics file into structured lines
 *
 * @param content - Raw lyrics file content
 * @returns Parsed lyrics with lines and section markers
 */
export function parseLyrics(content: string): ParsedLyrics {
  const rawLines = content.split('\n');
  const lines: ParsedLine[] = [];
  const sectionMarkers: SectionMarker[] = [];

  let currentSection: string | null = null;
  let lineIndex = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Check for section marker
    const markerMatch = trimmed.match(SECTION_MARKER_REGEX);
    if (markerMatch) {
      currentSection = trimmed;
      sectionMarkers.push({
        marker: trimmed,
        lineIndex,
      });
      continue;
    }

    // Regular lyric line
    lines.push({
      index: lineIndex,
      text: trimmed,
      sectionMarker: currentSection,
    });

    lineIndex++;
  }

  return { lines, sectionMarkers };
}

/**
 * Validate that English and Chinese lyrics match
 *
 * Checks:
 * 1. Same number of lyric lines (excluding section markers)
 * 2. Same section markers in same order
 * 3. Section markers at matching line indices
 *
 * @param enContent - English lyrics file content
 * @param zhContent - Chinese lyrics file content
 * @returns Validation result with warnings and errors
 */
export function validateLyrics(
  enContent: string,
  zhContent: string
): LyricsValidationResult {
  const en = parseLyrics(enContent);
  const zh = parseLyrics(zhContent);

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check line counts
  if (en.lines.length !== zh.lines.length) {
    errors.push(
      `Line count mismatch: en=${en.lines.length}, zh=${zh.lines.length}`
    );
  }

  // Check section marker counts
  if (en.sectionMarkers.length !== zh.sectionMarkers.length) {
    warnings.push(
      `Section marker count mismatch: en=${en.sectionMarkers.length}, zh=${zh.sectionMarkers.length}`
    );
  }

  // Check section markers match
  const maxMarkers = Math.max(en.sectionMarkers.length, zh.sectionMarkers.length);

  for (let i = 0; i < maxMarkers; i++) {
    const enMarker = en.sectionMarkers[i];
    const zhMarker = zh.sectionMarkers[i];

    if (!enMarker && zhMarker) {
      warnings.push(
        `Extra section in zh at line ${zhMarker.lineIndex}: ${zhMarker.marker}`
      );
      continue;
    }

    if (enMarker && !zhMarker) {
      warnings.push(
        `Missing section in zh: ${enMarker.marker} (en line ${enMarker.lineIndex})`
      );
      continue;
    }

    if (enMarker && zhMarker) {
      // Check if markers match (normalize for comparison)
      const enNormalized = normalizeMarker(enMarker.marker);
      const zhNormalized = normalizeMarker(zhMarker.marker);

      if (enNormalized !== zhNormalized) {
        warnings.push(
          `Section marker mismatch at position ${i}: en=${enMarker.marker}, zh=${zhMarker.marker}`
        );
      }

      // Check if line indices match
      if (enMarker.lineIndex !== zhMarker.lineIndex) {
        warnings.push(
          `Section position mismatch for ${enMarker.marker}: en=line ${enMarker.lineIndex}, zh=line ${zhMarker.lineIndex}`
        );
      }
    }
  }

  // Check for potential line alignment issues
  const minLines = Math.min(en.lines.length, zh.lines.length);
  for (let i = 0; i < minLines; i++) {
    const enLine = en.lines[i];
    const zhLine = zh.lines[i];

    // Warn if section markers don't match for a given line index
    if (enLine.sectionMarker !== zhLine.sectionMarker) {
      const enSection = enLine.sectionMarker || '(none)';
      const zhSection = zhLine.sectionMarker || '(none)';
      warnings.push(
        `Line ${i} section mismatch: en in ${enSection}, zh in ${zhSection}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    enLineCount: en.lines.length,
    zhLineCount: zh.lines.length,
  };
}

/**
 * Normalize section marker for comparison
 * Removes brackets and normalizes common variations
 */
function normalizeMarker(marker: string): string {
  return marker
    .toLowerCase()
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/–/g, '-')  // em-dash to hyphen
    .trim();
}

/**
 * Read and validate lyrics files
 *
 * @param enPath - Path to English lyrics file
 * @param zhPath - Path to Chinese lyrics file
 * @returns Parsed lyrics for both languages and validation result
 */
export async function readAndValidateLyrics(
  enPath: string,
  zhPath: string
): Promise<{
  en: ParsedLyrics;
  zh: ParsedLyrics;
  validation: LyricsValidationResult;
}> {
  const enFile = Bun.file(enPath);
  const zhFile = Bun.file(zhPath);

  if (!(await enFile.exists())) {
    throw new Error(`English lyrics file not found: ${enPath}`);
  }

  if (!(await zhFile.exists())) {
    throw new Error(`Chinese lyrics file not found: ${zhPath}`);
  }

  const enContent = await enFile.text();
  const zhContent = await zhFile.text();

  const en = parseLyrics(enContent);
  const zh = parseLyrics(zhContent);
  const validation = validateLyrics(enContent, zhContent);

  return { en, zh, validation };
}

/**
 * Print validation result to console
 */
export function printValidationResult(result: LyricsValidationResult): void {
  console.log('\n📋 Lyrics Validation');
  console.log(`   EN lines: ${result.enLineCount}`);
  console.log(`   ZH lines: ${result.zhLineCount}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach((e) => console.log(`   ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach((w) => console.log(`   ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('\n✅ Lyrics validated successfully');
  } else if (result.valid) {
    console.log('\n✅ Lyrics valid (with warnings)');
  } else {
    console.log('\n❌ Lyrics validation failed');
  }
}

/**
 * Combine EN and ZH lyrics into paired lines
 *
 * @param en - Parsed English lyrics
 * @param zh - Parsed Chinese lyrics
 * @returns Array of paired lines (en + zh at same index)
 */
export function pairLyrics(
  en: ParsedLyrics,
  zh: ParsedLyrics
): Array<{ index: number; en: string; zh: string; section: string | null }> {
  const paired: Array<{
    index: number;
    en: string;
    zh: string;
    section: string | null;
  }> = [];

  const maxLines = Math.max(en.lines.length, zh.lines.length);

  for (let i = 0; i < maxLines; i++) {
    const enLine = en.lines[i];
    const zhLine = zh.lines[i];

    paired.push({
      index: i,
      en: enLine?.text || '',
      zh: zhLine?.text || '',
      section: enLine?.sectionMarker || zhLine?.sectionMarker || null,
    });
  }

  return paired;
}

/**
 * Validate ISWC format (no dots)
 *
 * @param iswc - ISWC string
 * @returns true if valid format
 */
export function validateISWC(iswc: string): boolean {
  // Format: T followed by 9 digits, then hyphen and 1 digit
  // e.g., T0704563291 or T070456329-1
  return /^T\d{9,10}(-\d)?$/.test(iswc);
}

/**
 * Normalize ISWC (remove dots if present)
 */
export function normalizeISWC(iswc: string): string {
  return iswc.replace(/[.-]/g, '');
}
