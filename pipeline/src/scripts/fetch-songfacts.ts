#!/usr/bin/env bun
/**
 * Fetch SongFacts for a song
 *
 * Scrapes trivia from songfacts.com and stores in database.
 * Alternative to Genius API (which has rate limiting issues).
 *
 * Usage:
 *   bun src/scripts/fetch-songfacts.ts --iswc=T0112199333
 *   bun src/scripts/fetch-songfacts.ts --spotify-id=717TY4sfgKQm4kFbYQIzgo
 *   bun src/scripts/fetch-songfacts.ts --all          # Process all songs
 *   bun src/scripts/fetch-songfacts.ts --iswc=T0112199333 --dry-run
 */

import { parseArgs } from 'util';
import { getSongByISWC, getSongBySpotifyTrackId, createSongFacts, getSongFactsBySong } from '../db/queries';
import { getArtistById } from '../db/queries';
import { query } from '../db/connection';
import { fetchSongFacts, searchSongFacts, fetchSongFactsByUrl, toSlug } from '../services/songfacts';
import type { Song } from '../types';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'spotify-id': { type: 'string' },
    all: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false }, // Re-fetch even if facts exist
  },
});

async function getSongWithArtist(song: Song): Promise<{ song: Song; artistName: string }> {
  let artistName = 'Unknown';
  if (song.artist_id) {
    const artist = await getArtistById(song.artist_id);
    if (artist) {
      artistName = artist.name;
    }
  }
  return { song, artistName };
}

async function fetchFactsForSong(
  song: Song,
  artistName: string,
  dryRun: boolean
): Promise<{ found: boolean; count: number; url?: string }> {
  console.log(`\nFetching SongFacts for: "${song.title}" by ${artistName}`);

  // Try direct URL first (most reliable)
  let result = await fetchSongFacts(artistName, song.title);

  // If not found, try search
  if (!result) {
    console.log('  Direct URL not found, trying search...');
    const searchResults = await searchSongFacts(`${song.title} ${artistName}`);

    if (searchResults.length > 0) {
      // Find best match
      const songSlug = toSlug(song.title);
      const artistSlug = toSlug(artistName);

      const match = searchResults.find((r) => {
        const rSongSlug = toSlug(r.title);
        const rArtistSlug = toSlug(r.artist);
        return rSongSlug === songSlug && rArtistSlug === artistSlug;
      });

      if (match) {
        console.log(`  Found match via search: ${match.url}`);
        result = await fetchSongFactsByUrl(match.url);
      } else if (searchResults.length === 1) {
        // Only one result, probably correct
        console.log(`  Using single search result: ${searchResults[0].url}`);
        result = await fetchSongFactsByUrl(searchResults[0].url);
      } else {
        console.log(`  Multiple results found, no exact match:`);
        searchResults.slice(0, 3).forEach((r) => {
          console.log(`    - "${r.title}" by ${r.artist}`);
        });
      }
    }
  }

  if (!result || result.facts.length === 0) {
    console.log('  No facts found on SongFacts');
    return { found: false, count: 0 };
  }

  console.log(`  Found ${result.facts.length} facts`);

  if (dryRun) {
    console.log('\n  [DRY RUN] Would save facts:');
    result.facts.forEach((fact, i) => {
      const preview = fact.text.slice(0, 100) + (fact.text.length > 100 ? '...' : '');
      console.log(`    ${i + 1}. ${preview}`);
    });
    return { found: true, count: result.facts.length, url: result.url };
  }

  // Save to database
  const factData = result.facts.map((fact, index) => ({
    song_id: song.id,
    fact_index: index,
    text: fact.text,
    html: fact.html,
    source_url: result.url,
  }));

  await createSongFacts(factData);
  console.log(`  Saved ${factData.length} facts to database`);

  return { found: true, count: result.facts.length, url: result.url };
}

async function main() {
  const dryRun = values['dry-run'] ?? false;
  const force = values.force ?? false;

  if (dryRun) {
    console.log('[DRY RUN MODE]');
  }

  let songs: Array<{ song: Song; artistName: string }> = [];

  if (values.all) {
    // Fetch all songs
    const allSongs = await query<Song>(`SELECT * FROM songs ORDER BY title`);
    console.log(`Found ${allSongs.length} songs in database`);

    for (const song of allSongs) {
      const { artistName } = await getSongWithArtist(song);
      songs.push({ song, artistName });
    }
  } else if (values.iswc) {
    const song = await getSongByISWC(values.iswc);
    if (!song) {
      console.error(`Song not found: ${values.iswc}`);
      process.exit(1);
    }
    const { artistName } = await getSongWithArtist(song);
    songs.push({ song, artistName });
  } else if (values['spotify-id']) {
    const song = await getSongBySpotifyTrackId(values['spotify-id']);
    if (!song) {
      console.error(`Song not found: ${values['spotify-id']}`);
      process.exit(1);
    }
    const { artistName } = await getSongWithArtist(song);
    songs.push({ song, artistName });
  } else {
    console.error('Usage: bun src/scripts/fetch-songfacts.ts --iswc=<ISWC> | --spotify-id=<ID> | --all');
    process.exit(1);
  }

  let processed = 0;
  let found = 0;
  let skipped = 0;
  let totalFacts = 0;

  for (const { song, artistName } of songs) {
    // Check if facts already exist
    if (!force) {
      const existingFacts = await getSongFactsBySong(song.id);
      if (existingFacts.length > 0) {
        console.log(`\nSkipping "${song.title}" - ${existingFacts.length} facts already exist (use --force to re-fetch)`);
        skipped++;
        continue;
      }
    }

    try {
      const result = await fetchFactsForSong(song, artistName, dryRun);
      processed++;
      if (result.found) {
        found++;
        totalFacts += result.count;
      }

      // Polite delay between requests (3 seconds)
      if (songs.length > 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (error) {
      console.error(`  Error fetching facts for "${song.title}":`, error);
      processed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`Found facts: ${found}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Total facts: ${totalFacts}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
