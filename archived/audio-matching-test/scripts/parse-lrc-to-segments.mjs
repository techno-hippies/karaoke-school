#!/usr/bin/env node
/**
 * Parse LRC lyrics into segments for STT matching test
 */

import { readFileSync, writeFileSync } from 'fs';

function parseLRC(lrcText) {
  const lines = lrcText.trim().split('\n');
  const parsed = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\]\s*(.+)/);
    if (match) {
      const [, mins, secs, text] = match;
      const timeInSeconds = parseInt(mins) * 60 + parseFloat(secs);
      parsed.push({ time: timeInSeconds, text: text.trim() });
    }
  }

  return parsed;
}

/**
 * Detect sections by finding repeated patterns
 */
function detectSections(parsedLines) {
  const sections = [];

  // Key phrases that mark section boundaries
  const chorusMarker = "you call me pretty little thing";

  let currentSection = {
    lines: [],
    startTime: 0,
    type: 'verse'
  };

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    const nextLine = parsedLines[i + 1];

    // Add line to current section
    if (currentSection.lines.length === 0) {
      currentSection.startTime = line.time;
    }
    currentSection.lines.push(line);

    // Check if we should break to new section
    const isChorusStart = line.text.toLowerCase().includes(chorusMarker);
    const timeGap = nextLine ? nextLine.time - line.time : 0;
    const nextIsChorus = nextLine && nextLine.text.toLowerCase().includes(chorusMarker);

    // Break if:
    // 1. Next line starts a new chorus
    // 2. We have at least 4 lines in current section AND (time gap > 3s OR we've been in section for 30s+)
    const sectionDuration = line.time - currentSection.startTime;
    const shouldBreak = nextIsChorus ||
                       (currentSection.lines.length >= 4 && (timeGap > 3 || sectionDuration > 30));

    if (shouldBreak && nextLine) {
      // Save current section
      if (isChorusStart || currentSection.lines.some(l => l.text.toLowerCase().includes(chorusMarker))) {
        currentSection.type = 'chorus';
      }
      sections.push(currentSection);

      // Start new section
      currentSection = {
        lines: [],
        startTime: 0,
        type: 'verse'
      };
    }
  }

  // Add final section
  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Convert sections to segment format
 */
function sectionsToSegments(sections) {
  const segments = [];
  let chorusCount = 0;
  let verseCount = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];

    // Determine section type and ID
    let sectionType;
    let id;

    if (i === 0 && section.startTime < 20) {
      sectionType = 'Intro';
      id = 'intro';
    } else if (section.type === 'chorus') {
      chorusCount++;
      sectionType = `Chorus ${chorusCount}`;
      id = `chorus-${chorusCount}`;
    } else {
      verseCount++;
      sectionType = `Verse ${verseCount}`;
      id = `verse-${verseCount}`;
    }

    // Calculate end time
    const endTime = nextSection
      ? nextSection.startTime
      : section.lines[section.lines.length - 1].time + 5; // Add 5s buffer for last section

    // Combine lyrics
    const lyrics = section.lines.map(l => l.text).join(' ');

    segments.push({
      id,
      sectionType,
      startTime: section.startTime,
      endTime,
      lyrics
    });
  }

  return segments;
}

function main() {
  const lrcFile = process.argv[2] || 'lyrics.txt';
  const outputFile = process.argv[3] || 'segments.json';

  console.log(`📖 Reading LRC file: ${lrcFile}`);
  const lrcText = readFileSync(lrcFile, 'utf-8');

  console.log('🔍 Parsing LRC format...');
  const parsedLines = parseLRC(lrcText);
  console.log(`   Found ${parsedLines.length} lines`);

  console.log('🎵 Detecting sections...');
  const sections = detectSections(parsedLines);
  console.log(`   Found ${sections.length} sections`);

  console.log('📝 Converting to segment format...');
  const segments = sectionsToSegments(sections);

  console.log(`\n✅ Created ${segments.length} segments:`);
  segments.forEach(seg => {
    const duration = seg.endTime - seg.startTime;
    console.log(`   ${seg.id}: ${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s (${duration.toFixed(1)}s) - ${seg.lyrics.substring(0, 50)}...`);
  });

  console.log(`\n💾 Writing to ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(segments, null, 2));
  console.log('✅ Done!\n');
}

main();
