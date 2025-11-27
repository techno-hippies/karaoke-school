#!/usr/bin/env bun
/**
 * Generate Karaoke Video
 *
 * Creates a karaoke video with character-by-character Chinese highlighting.
 * Uses \c color tags (not \kf) to avoid rendering bugs with mixed scripts.
 *
 * Usage:
 *   bun src/scripts/generate-karaoke-video.ts \
 *     --iswc=T0112199333 \
 *     --song-dir=songs/T0112199333
 *
 * Expected files in song-dir:
 *   - background.mp4  (raw video)
 *   - vocals.mp3      (audio clip with vocals)
 *   - alignment.json  (character-level timing from ElevenLabs)
 *
 * Outputs:
 *   - clip.ass  (subtitle file)
 *   - clip.mp4  (final video)
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import * as fs from 'fs';
import * as path from 'path';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'song-dir': { type: 'string' },
  },
  strict: true,
});

interface CharTiming {
  text: string;
  start: number;
  end: number;
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

  // Style - Chinese at TOP, no shadow
  const fontSize = Math.round(height * 0.04);
  const marginV = Math.round(height * 0.03);
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  lines.push(`Style: Default,Noto Sans SC,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,8,20,20,${marginV},1`);
  lines.push('');

  // Split chars into lines by \n
  const zhLines: { chars: CharTiming[]; text: string; start: number; end: number }[] = [];
  let currentLine: CharTiming[] = [];

  for (const char of chars) {
    if (char.text === '\n') {
      if (currentLine.length > 0) {
        const lineText = currentLine.map(c => c.text).join('');
        zhLines.push({
          chars: currentLine,
          text: lineText,
          start: currentLine[0].start,
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
    zhLines.push({
      chars: currentLine,
      text: lineText,
      start: currentLine[0].start,
      end: currentLine[currentLine.length - 1].end,
    });
  }

  // Events - character-by-character highlighting
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const zhLine of zhLines) {
    // Group consecutive chars with same timing to reduce dialogue count
    let i = 0;
    while (i < zhLine.chars.length) {
      const char = zhLine.chars[i];

      // Find end of this timing group (spaces often have same timing as adjacent char)
      let groupEnd = i;
      while (groupEnd + 1 < zhLine.chars.length &&
             zhLine.chars[groupEnd + 1].start === char.start &&
             zhLine.chars[groupEnd + 1].end === char.end) {
        groupEnd++;
      }

      // Build text with current char(s) highlighted in yellow
      let text = '';
      for (let j = 0; j < zhLine.chars.length; j++) {
        if (j >= i && j <= groupEnd) {
          text += `{\\c&H00FFFF&}${zhLine.chars[j].text}{\\c&HFFFFFF&}`;
        } else {
          text += zhLine.chars[j].text;
        }
      }

      lines.push(`Dialogue: 0,${toAss(char.start)},${toAss(char.end)},Default,,0,0,0,,${text}`);
      i = groupEnd + 1;
    }
  }

  return lines.join('\n');
}

async function main() {
  const songDir = values['song-dir'] || (values.iswc ? `songs/${values.iswc}` : null);

  if (!songDir) {
    console.error('Usage: bun src/scripts/generate-karaoke-video.ts --iswc=T0112199333');
    console.error('   or: bun src/scripts/generate-karaoke-video.ts --song-dir=songs/T0112199333');
    process.exit(1);
  }

  const backgroundPath = path.join(songDir, 'background.mp4');
  const vocalsPath = path.join(songDir, 'vocals.mp3');
  const alignmentPath = path.join(songDir, 'alignment.json');
  const assPath = path.join(songDir, 'clip.ass');
  const outputPath = path.join(songDir, 'clip.mp4');

  // Verify required files exist
  for (const file of [backgroundPath, vocalsPath, alignmentPath]) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Missing required file: ${file}`);
      process.exit(1);
    }
  }

  console.log(`\n🎬 Generating Karaoke Video`);
  console.log(`   Directory: ${songDir}`);

  // Get video dimensions
  const probeResult = await $`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${backgroundPath}`.text();
  const [width, height] = probeResult.trim().split(',').map(Number);
  console.log(`   Resolution: ${width}x${height}`);

  // Load alignment
  const alignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf-8'));
  const chars: CharTiming[] = alignment.characters;
  console.log(`   Characters: ${chars.length}`);

  // Generate ASS
  const assContent = generateAss(chars, width, height);
  fs.writeFileSync(assPath, assContent);
  console.log(`   ASS: ${assPath}`);

  // Generate video with ffmpeg
  console.log(`\n🔧 Encoding...`);
  await $`ffmpeg -y -i ${backgroundPath} -i ${vocalsPath} -filter_complex "[0:v]ass=${assPath}[v]" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -shortest ${outputPath}`.quiet();

  const stat = fs.statSync(outputPath);
  console.log(`\n✅ Done: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
