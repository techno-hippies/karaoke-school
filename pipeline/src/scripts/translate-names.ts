#!/usr/bin/env bun
/**
 * Translate Names Script
 *
 * Translates song titles and artist names for existing songs in the database.
 * Uses OpenRouter (Gemini) to generate translations for all 12 supported languages:
 *   ZH, VI, ID, JA, KO, ES, PT, AR, TR, RU, HI, TH
 *
 * Usage:
 *   bun src/scripts/translate-names.ts --iswc=T0101545054         # Single song
 *   bun src/scripts/translate-names.ts --all                       # All songs missing translations
 *   bun src/scripts/translate-names.ts --all --dry-run             # Preview only
 *   bun src/scripts/translate-names.ts --all --limit=5             # Process 5 songs
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import {
  getSongByISWC,
  getArtistById,
  updateSongTranslations,
  updateArtistTranslations,
} from '../db/queries';
import { translateSongMetadata } from '../services/openrouter';
import { validateEnv, OPENROUTER_API_KEY } from '../config';
import type { Song, Artist } from '../types';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    all: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
  },
  strict: true,
});

interface SongWithArtist extends Song {
  artist_name: string;
  artist_spotify_id: string;
}

/**
 * Get songs missing translations (any of the 12 languages)
 */
async function getSongsMissingTranslations(limit?: number): Promise<SongWithArtist[]> {
  const limitClause = limit ? `LIMIT ${limit}` : '';

  const result = await query<SongWithArtist>(
    `SELECT s.*, a.name as artist_name, a.spotify_artist_id as artist_spotify_id
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE s.title_zh IS NULL OR s.title_vi IS NULL OR s.title_id IS NULL
        OR s.title_ja IS NULL OR s.title_ko IS NULL OR s.title_es IS NULL
        OR s.title_pt IS NULL OR s.title_ar IS NULL OR s.title_tr IS NULL
        OR s.title_ru IS NULL OR s.title_hi IS NULL OR s.title_th IS NULL
        OR a.name_zh IS NULL OR a.name_vi IS NULL OR a.name_id IS NULL
        OR a.name_ja IS NULL OR a.name_ko IS NULL OR a.name_es IS NULL
        OR a.name_pt IS NULL OR a.name_ar IS NULL OR a.name_tr IS NULL
        OR a.name_ru IS NULL OR a.name_hi IS NULL OR a.name_th IS NULL
     ORDER BY s.created_at DESC
     ${limitClause}`
  );

  return result;
}

/**
 * Check if song needs translation (any of 12 languages missing)
 */
function songNeedsTranslation(song: Song): boolean {
  return !song.title_zh || !song.title_vi || !song.title_id || !song.title_ja || !song.title_ko
      || !song.title_es || !song.title_pt || !song.title_ar || !song.title_tr
      || !song.title_ru || !song.title_hi || !song.title_th;
}

/**
 * Check if artist needs translation (any of 12 languages missing)
 */
function artistNeedsTranslation(artist: Artist): boolean {
  return !artist.name_zh || !artist.name_vi || !artist.name_id || !artist.name_ja || !artist.name_ko
      || !artist.name_es || !artist.name_pt || !artist.name_ar || !artist.name_tr
      || !artist.name_ru || !artist.name_hi || !artist.name_th;
}

/**
 * Translate a single song and its artist
 */
async function translateSong(
  song: Song,
  artist: Artist,
  dryRun: boolean
): Promise<void> {
  console.log(`\n🌍 Translating: "${song.title}" by ${artist.name}`);

  try {
    const metadata = await translateSongMetadata(song.title, artist.name);

    // Log all 12 languages
    console.log(`   Titles: ZH=${metadata.title_zh} | JA=${metadata.title_ja} | KO=${metadata.title_ko}`);
    console.log(`           ES=${metadata.title_es} | PT=${metadata.title_pt} | RU=${metadata.title_ru}`);
    console.log(`           AR=${metadata.title_ar} | TR=${metadata.title_tr} | HI=${metadata.title_hi} | TH=${metadata.title_th}`);

    if (!dryRun) {
      // Update song translations (fill in missing ones)
      if (songNeedsTranslation(song)) {
        await updateSongTranslations(song.iswc, {
          title_zh: song.title_zh || metadata.title_zh,
          title_vi: song.title_vi || metadata.title_vi,
          title_id: song.title_id || metadata.title_id,
          title_ja: song.title_ja || metadata.title_ja,
          title_ko: song.title_ko || metadata.title_ko,
          title_es: song.title_es || metadata.title_es,
          title_pt: song.title_pt || metadata.title_pt,
          title_ar: song.title_ar || metadata.title_ar,
          title_tr: song.title_tr || metadata.title_tr,
          title_ru: song.title_ru || metadata.title_ru,
          title_hi: song.title_hi || metadata.title_hi,
          title_th: song.title_th || metadata.title_th,
        });
        console.log('   ✅ Song translations saved');
      }

      // Update artist translations (fill in missing ones)
      if (artistNeedsTranslation(artist)) {
        await updateArtistTranslations(artist.spotify_artist_id, {
          name_zh: artist.name_zh || metadata.artist_zh,
          name_vi: artist.name_vi || metadata.artist_vi,
          name_id: artist.name_id || metadata.artist_id,
          name_ja: artist.name_ja || metadata.artist_ja,
          name_ko: artist.name_ko || metadata.artist_ko,
          name_es: artist.name_es || metadata.artist_es,
          name_pt: artist.name_pt || metadata.artist_pt,
          name_ar: artist.name_ar || metadata.artist_ar,
          name_tr: artist.name_tr || metadata.artist_tr,
          name_ru: artist.name_ru || metadata.artist_ru,
          name_hi: artist.name_hi || metadata.artist_hi,
          name_th: artist.name_th || metadata.artist_th,
        });
        console.log('   ✅ Artist translations saved');
      }
    } else {
      console.log('   (dry run - not saved)');
    }
  } catch (error: any) {
    console.error(`   ❌ Translation failed: ${error.message}`);
  }
}

async function main() {
  validateEnv(['DATABASE_URL']);

  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
  }

  const dryRun = values['dry-run'];
  const limit = values.limit ? parseInt(values.limit) : undefined;

  console.log('\n🌍 Translate Names Script');
  if (dryRun) console.log('   Mode: DRY RUN');

  if (values.iswc) {
    // Single song mode
    const song = await getSongByISWC(values.iswc);
    if (!song) {
      console.error(`❌ Song not found: ${values.iswc}`);
      process.exit(1);
    }

    if (!song.artist_id) {
      console.error('❌ Song has no artist linked');
      process.exit(1);
    }

    const artist = await getArtistById(song.artist_id);
    if (!artist) {
      console.error('❌ Artist not found');
      process.exit(1);
    }

    await translateSong(song, artist, dryRun);

  } else if (values.all) {
    // Batch mode - all songs missing translations
    console.log('\n📋 Finding songs missing translations...');
    const songs = await getSongsMissingTranslations(limit);
    console.log(`   Found ${songs.length} songs`);

    if (songs.length === 0) {
      console.log('\n✅ All songs have translations!');
      process.exit(0);
    }

    // Track unique artists to avoid duplicate API calls
    const processedArtists = new Set<string>();

    for (const songRow of songs) {
      // Get full song and artist objects
      const song = await getSongByISWC(songRow.iswc);
      if (!song || !song.artist_id) continue;

      const artist = await getArtistById(song.artist_id);
      if (!artist) continue;

      // Skip if this artist was already processed and has all translations
      const artistKey = artist.spotify_artist_id;
      if (processedArtists.has(artistKey) && !artistNeedsTranslation(artist)) {
        // Just translate song title if needed
        if (songNeedsTranslation(song)) {
          console.log(`\n🌍 Translating: "${song.title}" (artist already done)`);
          try {
            const metadata = await translateSongMetadata(song.title, artist.name);
            console.log(`   Titles: ZH=${metadata.title_zh} | JA=${metadata.title_ja} | KO=${metadata.title_ko}`);
            console.log(`           ES=${metadata.title_es} | PT=${metadata.title_pt} | RU=${metadata.title_ru}`);

            if (!dryRun) {
              await updateSongTranslations(song.iswc, {
                title_zh: song.title_zh || metadata.title_zh,
                title_vi: song.title_vi || metadata.title_vi,
                title_id: song.title_id || metadata.title_id,
                title_ja: song.title_ja || metadata.title_ja,
                title_ko: song.title_ko || metadata.title_ko,
                title_es: song.title_es || metadata.title_es,
                title_pt: song.title_pt || metadata.title_pt,
                title_ar: song.title_ar || metadata.title_ar,
                title_tr: song.title_tr || metadata.title_tr,
                title_ru: song.title_ru || metadata.title_ru,
                title_hi: song.title_hi || metadata.title_hi,
                title_th: song.title_th || metadata.title_th,
              });
              console.log('   ✅ Song translations saved');
            }
          } catch (error: any) {
            console.error(`   ❌ Translation failed: ${error.message}`);
          }
        }
        continue;
      }

      await translateSong(song, artist, dryRun);
      processedArtists.add(artistKey);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } else {
    console.error('❌ Must specify --iswc=<iswc> or --all');
    console.log('\nUsage:');
    console.log('  bun src/scripts/translate-names.ts --iswc=T0101545054');
    console.log('  bun src/scripts/translate-names.ts --all');
    console.log('  bun src/scripts/translate-names.ts --all --dry-run');
    console.log('  bun src/scripts/translate-names.ts --all --limit=5');
    process.exit(1);
  }

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
