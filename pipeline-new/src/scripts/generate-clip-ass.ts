#!/usr/bin/env bun
/**
 * Generate ASS subtitles from character-level alignment JSON.
 *
 * Uses the same format as the working Eminem clip:
 * - Character-by-character highlighting for ZH (color tags)
 * - EN line spans full duration below ZH
 * - Both at TOP of screen, stacked
 */

import { parseArgs } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    alignment: { type: 'string' },  // path to alignment JSON
    'en-lines': { type: 'string' }, // EN lines (newline separated)
    width: { type: 'string', default: '1080' },
    height: { type: 'string', default: '1920' },
    output: { type: 'string' },
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

function main() {
  if (!values.alignment || !values['en-lines']) {
    console.log('Usage: bun src/scripts/generate-clip-ass.ts --alignment=path.json --en-lines="line1\\nline2"');
    process.exit(1);
  }

  const alignmentPath = values.alignment;
  const enLines = values['en-lines'].replace(/\\n/g, '\n').split('\n');
  const width = parseInt(values.width!);
  const height = parseInt(values.height!);
  const outputPath = values.output || alignmentPath.replace('.json', '.ass');

  console.log('\n📄 Generating ASS');
  console.log(`   Alignment: ${alignmentPath}`);
  console.log(`   EN lines: ${enLines.length}`);

  // Load alignment
  const alignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf-8'));
  const chars: CharTiming[] = alignment.characters;

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

  console.log(`   ZH lines parsed: ${zhLines.length}`);

  // Build ASS
  const lines: string[] = [];

  // Header
  lines.push('[Script Info]');
  lines.push('Title: Karaoke - Character Highlight');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${width}`);
  lines.push(`PlayResY: ${height}`);
  lines.push('WrapStyle: 0');
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('');

  // Styles - both at TOP (alignment 8), ZH higher margin, EN lower
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  lines.push('Style: Chinese,Noto Sans SC,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,8,20,20,60,1');
  lines.push('Style: English,Arial,42,&H00CCCCCC,&H00CCCCCC,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,8,20,20,140,1');
  lines.push('');

  // Events
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  // Generate dialogue for each line
  for (let lineIdx = 0; lineIdx < zhLines.length; lineIdx++) {
    const zhLine = zhLines[lineIdx];
    const enText = enLines[lineIdx] || '';

    // Character-by-character highlighting for ZH
    for (let i = 0; i < zhLine.chars.length; i++) {
      const char = zhLine.chars[i];
      // Skip spaces for highlighting but keep in text

      // Build text with current char highlighted in yellow
      let text = '';
      for (let j = 0; j < zhLine.chars.length; j++) {
        if (j === i) {
          text += `{\\c&H00FFFF&}${zhLine.chars[j].text}{\\c&HFFFFFF&}`;
        } else {
          text += zhLine.chars[j].text;
        }
      }

      // Each char's timing
      const startTime = char.start;
      const endTime = char.end;

      lines.push(`Dialogue: 0,${toAss(startTime)},${toAss(endTime)},Chinese,,0,0,0,,${text}`);
    }

    // EN line spans full ZH line duration
    lines.push(`Dialogue: 0,${toAss(zhLine.start)},${toAss(zhLine.end)},English,,0,0,0,,${enText}`);
  }

  // Write ASS
  const assContent = lines.join('\n');
  fs.writeFileSync(outputPath, assContent);
  console.log(`\n✅ Saved: ${outputPath}`);
}

main();
