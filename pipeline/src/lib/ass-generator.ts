/**
 * ASS Subtitle Generator
 *
 * Creates dual-language karaoke subtitles:
 * - English: Static display (white)
 * - Chinese: Karaoke highlighting (yellow fill as words are sung)
 */

import type { Lyric, WordTiming } from '../types';

interface AssStyle {
  name: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;   // &HAABBGGRR format
  secondaryColor: string;
  outlineColor: string;
  backColor: string;
  bold: boolean;
  alignment: number;      // 1-9 numpad positions
  marginV: number;
}

interface KaraokeEvent {
  startMs: number;
  endMs: number;
  enText: string;
  zhText: string;
  wordTimings: WordTiming[];
}

// ASS color format: &HAABBGGRR (Alpha, Blue, Green, Red)
const COLORS = {
  white: '&H00FFFFFF',
  yellow: '&H0000FFFF',
  black: '&H00000000',
  transparent: '&HFF000000',
  shadow: '&H80000000',
};

const DEFAULT_STYLES: AssStyle[] = [
  {
    name: 'Chinese',
    fontName: 'Noto Sans SC',
    fontSize: 56,
    primaryColor: COLORS.white,
    secondaryColor: COLORS.yellow, // Karaoke fill color
    outlineColor: COLORS.black,
    backColor: COLORS.shadow,
    bold: true,
    alignment: 2, // Bottom center
    marginV: 40, // Closer to bottom edge
  },
];

const ENGLISH_STYLES: AssStyle[] = [
  {
    name: 'English',
    fontName: 'Noto Sans',
    fontSize: 56,
    primaryColor: COLORS.white,
    secondaryColor: COLORS.yellow, // Karaoke fill color
    outlineColor: COLORS.black,
    backColor: COLORS.shadow,
    bold: true,
    alignment: 8, // Top center
    marginV: 40,
  },
];

// Dual-language: English karaoke at top, Chinese translation below
const DUAL_STYLES: AssStyle[] = [
  {
    name: 'English',
    fontName: 'Noto Sans',
    fontSize: 56,
    primaryColor: COLORS.white,
    secondaryColor: COLORS.yellow, // Karaoke fill color
    outlineColor: COLORS.black,
    backColor: COLORS.shadow,
    bold: true,
    alignment: 8, // Top center
    marginV: 40,
  },
  {
    name: 'Chinese',
    fontName: 'Noto Sans SC',
    fontSize: 52,
    primaryColor: COLORS.white,
    secondaryColor: COLORS.white, // No karaoke effect
    outlineColor: COLORS.black,
    backColor: COLORS.shadow,
    bold: false,
    alignment: 8, // Top center (below English)
    marginV: 120, // Below the English line
  },
];

/**
 * Format milliseconds to ASS timestamp (H:MM:SS.cc)
 */
function msToAss(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((totalSeconds % 1) * 100);

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * Format ASS style line
 */
function formatStyle(style: AssStyle): string {
  return `Style: ${style.name},${style.fontName},${style.fontSize},${style.primaryColor},${style.secondaryColor},${style.outlineColor},${style.backColor},${style.bold ? 1 : 0},0,0,0,100,100,0,0,1,2,1,${style.alignment},10,10,${style.marginV},1`;
}

/**
 * Generate karaoke timing tags for a line
 *
 * Uses \k (fill from left) for karaoke effect
 * Duration is in centiseconds
 */
function generateKaraokeTags(
  text: string,
  wordTimings: WordTiming[],
  lineStartMs: number
): string {
  if (wordTimings.length === 0) {
    return text;
  }

  let result = '';
  let textIndex = 0;

  for (let i = 0; i < wordTimings.length; i++) {
    const timing = wordTimings[i];
    const wordStartMs = timing.start * 1000;
    const wordEndMs = timing.end * 1000;
    const durationCs = Math.round((wordEndMs - wordStartMs) / 10);

    // Find word in text
    const wordStart = text.indexOf(timing.text, textIndex);
    if (wordStart === -1) {
      // Word not found, skip
      continue;
    }

    // Add any text before this word (spaces, punctuation)
    if (wordStart > textIndex) {
      const prefix = text.slice(textIndex, wordStart);
      result += prefix;
    }

    // Add karaoke tag and word
    result += `{\\kf${durationCs}}${timing.text}`;
    textIndex = wordStart + timing.text.length;
  }

  // Add remaining text
  if (textIndex < text.length) {
    result += text.slice(textIndex);
  }

  return result;
}

/**
 * Generate ASS subtitle file content
 *
 * Language modes:
 * - 'zh': Chinese karaoke only (default)
 * - 'en': English karaoke only
 * - 'en-zh': English karaoke + Chinese translation below
 */
export function generateAssSubtitles(
  events: KaraokeEvent[],
  width = 1440,
  height = 1440,
  styles = DEFAULT_STYLES,
  language: 'zh' | 'en' | 'en-zh' = 'zh'
): string {
  const lines: string[] = [];
  const useStyles = language === 'en-zh' ? DUAL_STYLES :
                    language === 'en' ? ENGLISH_STYLES : styles;

  // Script Info
  lines.push('[Script Info]');
  lines.push('Title: Karaoke Subtitles');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${width}`);
  lines.push(`PlayResY: ${height}`);
  lines.push('WrapStyle: 0');
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('');

  // Styles
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  for (const style of useStyles) {
    lines.push(formatStyle(style));
  }
  lines.push('');

  // Events
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const event of events) {
    const start = msToAss(event.startMs);
    const end = msToAss(event.endMs);

    if (language === 'en-zh') {
      // Dual language: English karaoke + Chinese translation
      if (event.enText && event.wordTimings.length > 0) {
        const karaokeText = generateKaraokeTags(event.enText, event.wordTimings, event.startMs);
        lines.push(`Dialogue: 0,${start},${end},English,,0,0,0,,${karaokeText}`);
      } else if (event.enText) {
        lines.push(`Dialogue: 0,${start},${end},English,,0,0,0,,${event.enText}`);
      }
      // Chinese translation (static, below English)
      if (event.zhText) {
        lines.push(`Dialogue: 0,${start},${end},Chinese,,0,0,0,,${event.zhText}`);
      }
    } else {
      // Single language mode
      const text = language === 'en' ? event.enText : event.zhText;
      const styleName = language === 'en' ? 'English' : 'Chinese';

      if (text && event.wordTimings.length > 0) {
        const karaokeText = generateKaraokeTags(text, event.wordTimings, event.startMs);
        lines.push(`Dialogue: 0,${start},${end},${styleName},,0,0,0,,${karaokeText}`);
      } else if (text) {
        lines.push(`Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate karaoke events from paired lyrics
 */
export function lyricsToKaraokeEvents(
  enLyrics: Lyric[],
  zhLyrics: Lyric[]
): KaraokeEvent[] {
  const events: KaraokeEvent[] = [];

  // Create index map for Chinese lyrics
  const zhByIndex = new Map<number, Lyric>();
  for (const zh of zhLyrics) {
    zhByIndex.set(zh.line_index, zh);
  }

  for (const en of enLyrics) {
    // Skip lines without timing
    if (en.start_ms == null || en.end_ms == null) {
      continue;
    }

    const zh = zhByIndex.get(en.line_index);

    events.push({
      startMs: en.start_ms,
      endMs: en.end_ms,
      enText: en.text,
      zhText: zh?.text || '',
      wordTimings: (en.word_timings as WordTiming[]) || [],
    });
  }

  return events;
}

/**
 * Generate complete ASS file from lyrics
 *
 * Language modes:
 * - 'zh': Chinese karaoke only (default)
 * - 'en': English karaoke only
 * - 'en-zh': English karaoke + Chinese translation below
 */
export function generateKaraokeAss(
  enLyrics: Lyric[],
  zhLyrics: Lyric[],
  width = 1440,
  height = 1440,
  language: 'zh' | 'en' | 'en-zh' = 'zh'
): string {
  const events = lyricsToKaraokeEvents(enLyrics, zhLyrics);
  return generateAssSubtitles(events, width, height, DEFAULT_STYLES, language);
}
