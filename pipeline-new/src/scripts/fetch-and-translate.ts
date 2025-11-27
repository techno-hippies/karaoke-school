#!/usr/bin/env bun
/**
 * Fetch and Translate Lyrics Script
 *
 * 1. Fetches lyrics from Genius
 * 2. Cleans adlibs (yeah), (uh), etc.
 * 3. Keeps section markers [Verse 1], [Chorus]
 * 4. Translates to zh, vi, id
 * 5. Saves all versions to database
 *
 * Usage:
 *   bun src/scripts/fetch-and-translate.ts --iswc=T0718898588 --genius-id=80855
 *   bun src/scripts/fetch-and-translate.ts --iswc=T0718898588 --genius-url=https://genius.com/Eminem-lose-yourself-lyrics
 */

import { parseArgs } from 'util';
import { getSongByISWC, createLyrics, type CreateLyricData } from '../db/queries';
import { query } from '../db/connection';
import { searchLyrics, parseSyncedLyrics } from '../services/lrclib';
import { cleanLyrics, translateLyrics, LANGUAGES, type LanguageCode } from '../services/openrouter';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    artist: { type: 'string' },
    'skip-translate': { type: 'boolean', default: false },
    languages: { type: 'string', default: 'zh,vi,id' }, // Comma-separated
  },
  strict: true,
});

/**
 * Parse lyrics into lines, preserving section markers
 */
function parseLines(lyrics: string): Array<{ text: string; isMarker: boolean }> {
  return lyrics
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      text: line,
      isMarker: /^\[.+\]$/.test(line),
    }));
}

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'OPENROUTER_API_KEY']);

  // Validate args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/fetch-and-translate.ts --iswc=T0718898588');
    console.log('  bun src/scripts/fetch-and-translate.ts --iswc=T0718898588 --artist="Eminem"');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const targetLanguages = values.languages!.split(',') as LanguageCode[];

  console.log('\n📝 Fetch and Translate Lyrics');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Languages: en, ${targetLanguages.join(', ')}`);

  // Get song from database
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    console.log('   Run add-song.ts first to create the song entry.');
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);

  // Get artist name (from arg or fetch from DB)
  let artistName = values.artist;
  if (!artistName && song.artist_id) {
    const artist = await query<{ name: string }>(
      `SELECT name FROM artists WHERE id = $1`,
      [song.artist_id]
    );
    artistName = artist[0]?.name;
  }
  artistName = artistName || 'Unknown Artist';
  console.log(`   Artist: ${artistName}`);

  // Fetch lyrics from LRCLIB
  console.log('\n📥 Fetching lyrics from LRCLIB...');
  const lrcResult = await searchLyrics(song.title, artistName);

  if (!lrcResult) {
    console.error('❌ Lyrics not found on LRCLIB');
    console.log('   Try with explicit --artist="Artist Name"');
    process.exit(1);
  }

  // Get plain lyrics (prefer synced, fall back to plain)
  let rawLyrics: string;
  if (lrcResult.syncedLyrics) {
    const lines = parseSyncedLyrics(lrcResult.syncedLyrics);
    rawLyrics = lines.join('\n');
    console.log(`   Source: synced lyrics (${lines.length} lines)`);
  } else if (lrcResult.plainLyrics) {
    rawLyrics = lrcResult.plainLyrics;
    console.log(`   Source: plain lyrics`);
  } else {
    console.error('❌ No lyrics content found');
    process.exit(1);
  }

  console.log(`   Raw lines: ${rawLyrics.split('\n').length}`);

  // Clean lyrics (remove adlibs, keep markers)
  console.log('\n🧹 Cleaning lyrics...');
  const cleanedLyrics = await cleanLyrics(rawLyrics, song.title, 'Artist');
  console.log(`   Cleaned lines: ${cleanedLyrics.split('\n').length}`);

  // Parse into structured lines
  const parsedLines = parseLines(cleanedLyrics);
  const lyricLines = parsedLines.filter((l) => !l.isMarker);
  const allLines = parsedLines.map((l) => l.text);

  console.log(`   Lyric lines: ${lyricLines.length}`);
  console.log(`   Section markers: ${parsedLines.filter((l) => l.isMarker).length}`);

  // Clear existing lyrics for this song
  await query(`DELETE FROM lyrics WHERE song_id = $1`, [song.id]);

  // Store English lyrics in database
  console.log('\n💾 Storing English lyrics...');
  const enLyricsData: CreateLyricData[] = [];
  let lineIndex = 0;
  let currentSection: string | null = null;

  for (const { text, isMarker } of parsedLines) {
    if (isMarker) {
      currentSection = text;
      continue;
    }

    enLyricsData.push({
      song_id: song.id,
      line_index: lineIndex,
      language: 'en',
      text,
      section_marker: currentSection || undefined,
    });
    lineIndex++;
  }

  await createLyrics(enLyricsData);
  console.log(`   Stored ${enLyricsData.length} EN lines`);

  // Translate to target languages
  if (!values['skip-translate']) {
    for (const langCode of targetLanguages) {
      const lang = LANGUAGES[langCode];
      if (!lang) {
        console.warn(`⚠️  Unknown language: ${langCode}, skipping`);
        continue;
      }

      console.log(`\n🌐 Translating to ${lang.name}...`);

      try {
        const translatedLines = await translateLyrics(allLines, langCode, lang.name);

        // Store in database
        const lyricsData: CreateLyricData[] = [];
        let idx = 0;
        let section: string | null = null;

        for (let i = 0; i < translatedLines.length; i++) {
          const text = translatedLines[i];
          const isMarker = /^\[.+\]$/.test(text);

          if (isMarker) {
            section = text;
            continue;
          }

          lyricsData.push({
            song_id: song.id,
            line_index: idx,
            language: langCode as 'en' | 'zh',
            text,
            section_marker: section || undefined,
          });
          idx++;
        }

        await createLyrics(lyricsData);
        console.log(`   Stored ${lyricsData.length} ${langCode.toUpperCase()} lines`);

        // Delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`   ❌ Translation failed: ${error.message}`);
      }
    }
  }


  // Summary
  console.log('\n✅ Fetch and translate complete');
  console.log(`   Stored: en + ${targetLanguages.join(', ')}`);

  console.log('\n💡 Next steps:');
  console.log(`   • Process audio: bun src/scripts/process-audio.ts --iswc=${iswc}`);
  console.log(`   • Align lyrics: bun src/scripts/align-lyrics.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
