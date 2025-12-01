#!/usr/bin/env bun
/**
 * Generate Lens Post Cover Video
 *
 * Creates a karaoke video with smooth slider highlighting using ASS \kf tags
 * for posting to Lens feed / social media.
 *
 * Usage:
 *   bun src/scripts/generate-karaoke-video.ts \
 *     --video=songs/T0721262607/lens-post-cover.mp4 \
 *     --audio=songs/T0721262607/35.7-45.7.mp3 \
 *     --alignment=songs/T0721262607/alignment.json \
 *     --output=songs/T0721262607/lens-post-cover-final.mp4
 *
 *   # Or use song-dir with default file names:
 *   bun src/scripts/generate-karaoke-video.ts --song-dir=songs/T0721262607
 *
 * Outputs:
 *   - {output}.ass  (subtitle file, same name as output)
 *   - {output}.mp4  (final video with burned subtitles)
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

// Zod schema for alignment.json
const CharTimingSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  preSung: z.boolean().optional(),
});

const AlignmentSchema = z.object({
  characters: z.array(CharTimingSchema).min(1, 'Alignment must have at least one character'),
});

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'song-dir': { type: 'string' },
    video: { type: 'string' },
    audio: { type: 'string' },
    alignment: { type: 'string' },
    output: { type: 'string' },
  },
  strict: true,
});

interface CharTiming {
  text: string;
  start: number;
  end: number;
  preSung?: boolean; // Character was sung before video starts
}

interface AlignmentIssue {
  type: 'zero_duration' | 'gap' | 'negative_timing' | 'missing_chars';
  message: string;
  lineIndex?: number;
  charIndex?: number;
}

/**
 * Validate alignment data and report issues
 */
function validateAlignment(chars: CharTiming[]): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];

  // Split into lines
  const lines: CharTiming[][] = [];
  let currentLine: CharTiming[] = [];
  for (const char of chars) {
    if (char.text === '\n') {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [];
    } else {
      currentLine.push(char);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let prevEnd = 0;

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];

      // Check for negative timing (shouldn't happen after clamping)
      if (char.start < 0 || char.end < 0) {
        issues.push({
          type: 'negative_timing',
          message: `Negative timing at line ${lineIdx + 1}, char "${char.text}": ${char.start}-${char.end}`,
          lineIndex: lineIdx,
          charIndex: charIdx,
        });
      }

      // Check for 0-duration (not pre-sung)
      if (char.start === char.end && !char.preSung && char.start > 0) {
        issues.push({
          type: 'zero_duration',
          message: `Zero duration at line ${lineIdx + 1}, char "${char.text}" at ${char.start}s`,
          lineIndex: lineIdx,
          charIndex: charIdx,
        });
      }

      // Check for gaps (non-pre-sung chars)
      if (!char.preSung && char.start > prevEnd + 0.5) {
        issues.push({
          type: 'gap',
          message: `Gap of ${(char.start - prevEnd).toFixed(2)}s before line ${lineIdx + 1}, char "${char.text}"`,
          lineIndex: lineIdx,
          charIndex: charIdx,
        });
      }

      if (!char.preSung) {
        prevEnd = char.end;
      }
    }
  }

  return issues;
}

function toAss(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function generateAss(chars: CharTiming[], width: number, height: number): string {
  const lines: string[] = [];

  // Header
  lines.push('[Script Info]');
  lines.push('Title: Karaoke');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${width}`);
  lines.push(`PlayResY: ${height}`);
  lines.push('WrapStyle: 0');
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('');

  // Style - Chinese at TOP
  // PrimaryColour = unsung (white), SecondaryColour = sung/filling (yellow)
  const fontSize = Math.round(height * 0.04);
  const marginV = Math.round(height * 0.03);
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  // SecondaryColour is now yellow (&H00FFFF) for karaoke fill
  // Font: "Noto Sans CJK SC" (not "Noto Sans SC")
  lines.push(`Style: Default,Noto Sans CJK SC,${fontSize},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,8,20,20,${marginV},1`);
  lines.push('');

  // Split chars into lines by \n
  const zhLines: { chars: CharTiming[]; text: string; start: number; end: number }[] = [];
  let currentLine: CharTiming[] = [];

  for (const char of chars) {
    if (char.text === '\n') {
      if (currentLine.length > 0) {
        const lineText = currentLine.map(c => c.text).join('');
        // Find first non-preSung char for line start
        const firstReal = currentLine.find(c => !c.preSung);
        const lineStart = firstReal ? firstReal.start : 0;
        zhLines.push({
          chars: currentLine,
          text: lineText,
          start: lineStart,
          end: currentLine[currentLine.length - 1].end,
        });
        currentLine = [];
      }
    } else {
      currentLine.push(char);
    }
  }
  // Final line
  if (currentLine.length > 0) {
    const lineText = currentLine.map(c => c.text).join('');
    const firstReal = currentLine.find(c => !c.preSung);
    const lineStart = firstReal ? firstReal.start : 0;
    zhLines.push({
      chars: currentLine,
      text: lineText,
      start: lineStart,
      end: currentLine[currentLine.length - 1].end,
    });
  }

  // Events - one dialogue per line using \kf tags
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const zhLine of zhLines) {
    // Build text with \kf tags for each character
    // \kf<centiseconds> = karaoke fill effect
    let text = '';

    for (let i = 0; i < zhLine.chars.length; i++) {
      const char = zhLine.chars[i];

      if (char.preSung) {
        // Pre-sung: instant fill (0 centiseconds)
        text += `{\\kf0}${char.text}`;
      } else {
        // Calculate duration in centiseconds
        const durationCs = Math.max(1, Math.round((char.end - char.start) * 100));
        text += `{\\kf${durationCs}}${char.text}`;
      }
    }

    // Single dialogue entry for the entire line
    lines.push(`Dialogue: 0,${toAss(zhLine.start)},${toAss(zhLine.end)},Default,,0,0,0,,${text}`);
  }

  return lines.join('\n');
}

async function main() {
  const songDir = values['song-dir'] || (values.iswc ? `songs/${values.iswc}` : null);

  // Determine file paths - explicit args take precedence over song-dir defaults
  let videoPath = values.video;
  let audioPath = values.audio;
  let alignmentPath = values.alignment;
  let outputPath = values.output;

  if (songDir && !videoPath) {
    // Fall back to song-dir defaults
    videoPath = path.join(songDir, 'lens-post-cover.mp4');
    audioPath = audioPath || path.join(songDir, 'cover-audio.mp3');
    alignmentPath = alignmentPath || path.join(songDir, 'alignment.json');
    outputPath = outputPath || path.join(songDir, 'lens-post-cover-final.mp4');
  }

  if (!videoPath || !audioPath || !alignmentPath || !outputPath) {
    console.error('Usage:');
    console.error('  bun src/scripts/generate-karaoke-video.ts \\');
    console.error('    --video=path/to/video.mp4 \\');
    console.error('    --audio=path/to/audio.mp3 \\');
    console.error('    --alignment=path/to/alignment.json \\');
    console.error('    --output=path/to/output.mp4');
    console.error('');
    console.error('  Or use --song-dir for default file names:');
    console.error('  bun src/scripts/generate-karaoke-video.ts --song-dir=songs/T0721262607');
    process.exit(1);
  }

  const assPath = outputPath.replace(/\.mp4$/, '.ass');

  // Verify required files exist
  for (const file of [videoPath, audioPath, alignmentPath]) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Missing required file: ${file}`);
      process.exit(1);
    }
  }

  console.log(`\n🎬 Generating Lens Post Cover Video`);
  console.log(`   Video: ${videoPath}`);
  console.log(`   Audio: ${audioPath}`);
  console.log(`   Alignment: ${alignmentPath}`);
  console.log(`   Output: ${outputPath}`);

  // Get video dimensions
  const probeResult = await $`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${videoPath}`.text();
  const [width, height] = probeResult.trim().split(',').map(Number);
  console.log(`   Resolution: ${width}x${height}`);

  // Load and validate alignment
  const rawAlignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf-8'));
  const parseResult = AlignmentSchema.safeParse(rawAlignment);
  if (!parseResult.success) {
    console.error(`❌ Invalid alignment.json: ${parseResult.error.message}`);
    process.exit(1);
  }
  const chars: CharTiming[] = parseResult.data.characters;
  console.log(`   Characters: ${chars.length}`);

  // Validate alignment
  const issues = validateAlignment(chars);
  const preSungCount = chars.filter(c => c.preSung).length;
  console.log(`   Pre-sung: ${preSungCount} chars`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Alignment issues found (${issues.length}):`);
    for (const issue of issues.slice(0, 5)) {
      console.log(`   • ${issue.message}`);
    }
    if (issues.length > 5) {
      console.log(`   ... and ${issues.length - 5} more`);
    }
  } else {
    console.log(`   ✅ Alignment validated`);
  }

  // Generate ASS
  const assContent = generateAss(chars, width, height);
  fs.writeFileSync(assPath, assContent);
  console.log(`   ASS: ${assPath}`);

  // Generate video with ffmpeg
  console.log(`\n🔧 Encoding...`);
  await $`ffmpeg -y -i ${videoPath} -i ${audioPath} -filter_complex "[0:v]ass=${assPath}[v]" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -shortest ${outputPath}`.quiet();

  const stat = fs.statSync(outputPath);
  console.log(`\n✅ Done: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
