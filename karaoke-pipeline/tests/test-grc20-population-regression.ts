/**
 * GRC-20 Population Regression Test
 *
 * This test ensures that the refactored population scripts produce
 * identical results to the current database state.
 *
 * Test Strategy:
 * 1. Snapshot current GRC-20 data (artists, works, recordings)
 * 2. Wipe all GRC-20 tables
 * 3. Add constraints
 * 4. Run population scripts in order
 * 5. Compare new data to snapshot
 * 6. Report any differences
 *
 * Usage:
 *   bun tests/test-grc20-population-regression.ts
 *
 * IMPORTANT: This test is DESTRUCTIVE! It will wipe and repopulate GRC-20 tables.
 * Only run on test/dev databases, never on production!
 */

import { query } from '../src/db/neon';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Snapshot {
  artists: any[];
  works: any[];
  recordings: any[];
  timestamp: string;
}

const SNAPSHOT_PATH = '/tmp/grc20-snapshot.json';

async function createSnapshot(): Promise<Snapshot> {
  console.log('📸 Creating snapshot of current GRC-20 data...\n');

  const artists = await query(`
    SELECT * FROM grc20_artists
    ORDER BY id
  `);

  const works = await query(`
    SELECT * FROM grc20_works
    ORDER BY id
  `);

  const recordings = await query(`
    SELECT * FROM grc20_work_recordings
    ORDER BY id
  `);

  const snapshot: Snapshot = {
    artists,
    works,
    recordings,
    timestamp: new Date().toISOString()
  };

  // Save to file
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

  console.log(`✅ Snapshot created:`);
  console.log(`   Artists: ${artists.length}`);
  console.log(`   Works: ${works.length}`);
  console.log(`   Recordings: ${recordings.length}`);
  console.log(`   Saved to: ${SNAPSHOT_PATH}\n`);

  return snapshot;
}

function runScript(scriptPath: string, description: string): void {
  console.log(`🚀 Running: ${description}...`);
  try {
    execSync(`dotenvx run -f .env -- bun ${scriptPath}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    console.log(`✅ ${description} completed\n`);
  } catch (err) {
    console.error(`❌ ${description} FAILED`);
    throw err;
  }
}

async function getCurrentData(): Promise<Snapshot> {
  console.log('📊 Fetching current data...\n');

  const artists = await query(`
    SELECT * FROM grc20_artists
    ORDER BY id
  `);

  const works = await query(`
    SELECT * FROM grc20_works
    ORDER BY id
  `);

  const recordings = await query(`
    SELECT * FROM grc20_work_recordings
    ORDER BY id
  `);

  return {
    artists,
    works,
    recordings,
    timestamp: new Date().toISOString()
  };
}

function compareField(
  entity: string,
  index: number,
  field: string,
  expected: any,
  actual: any,
  ignoreFields: string[]
): boolean {
  // Skip ignored fields
  if (ignoreFields.includes(field)) return true;

  // Special handling for timestamps (allow small differences)
  if (field.includes('_at') || field === 'timestamp') {
    const diff = Math.abs(new Date(expected).getTime() - new Date(actual).getTime());
    if (diff < 5000) return true; // Allow 5s difference for created_at/updated_at
  }

  // Special handling for JSONB fields (compare stringified)
  if (typeof expected === 'object' && typeof actual === 'object') {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  // Normal comparison
  return expected === actual;
}

function compareData(snapshot: Snapshot, current: Snapshot): boolean {
  console.log('🔍 Comparing snapshot to current data...\n');

  let hasErrors = false;

  // Fields to ignore in comparison (timestamps, auto-generated)
  const ignoreFields = ['created_at', 'updated_at', 'id'];

  // Compare counts
  console.log('📊 Count Comparison:');
  if (snapshot.artists.length !== current.artists.length) {
    console.error(`   ❌ Artists: Expected ${snapshot.artists.length}, got ${current.artists.length}`);
    hasErrors = true;
  } else {
    console.log(`   ✅ Artists: ${current.artists.length}`);
  }

  if (snapshot.works.length !== current.works.length) {
    console.error(`   ❌ Works: Expected ${snapshot.works.length}, got ${current.works.length}`);
    hasErrors = true;
  } else {
    console.log(`   ✅ Works: ${current.works.length}`);
  }

  if (snapshot.recordings.length !== current.recordings.length) {
    console.error(`   ❌ Recordings: Expected ${snapshot.recordings.length}, got ${current.recordings.length}`);
    hasErrors = true;
  } else {
    console.log(`   ✅ Recordings: ${current.recordings.length}`);
  }

  console.log('');

  // Compare artists (by spotify_artist_id, not by ID)
  console.log('👤 Comparing Artists:');
  const artistMap = new Map(current.artists.map(a => [a.spotify_artist_id, a]));

  for (const expected of snapshot.artists) {
    const actual = artistMap.get(expected.spotify_artist_id);

    if (!actual) {
      console.error(`   ❌ Missing artist: ${expected.name} (spotify: ${expected.spotify_artist_id})`);
      hasErrors = true;
      continue;
    }

    // Compare key fields (skip 'id' since it's auto-generated)
    const keyFields = ['name', 'spotify_artist_id', 'genius_artist_id', 'isni', 'mbid'];
    for (const field of keyFields) {
      if (!compareField('artist', 0, field, expected[field], actual[field], ignoreFields)) {
        console.error(`   ❌ Artist ${expected.name}: ${field} mismatch`);
        console.error(`      Expected: ${JSON.stringify(expected[field])}`);
        console.error(`      Got:      ${JSON.stringify(actual[field])}`);
        hasErrors = true;
      }
    }

    artistMap.delete(expected.spotify_artist_id);
  }

  // Check for extra artists
  if (artistMap.size > 0) {
    for (const [spotifyId, artist] of artistMap) {
      console.error(`   ❌ Extra artist: ${artist.name} (spotify: ${spotifyId})`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`   ✅ All ${snapshot.artists.length} artists match`);
  }
  console.log('');

  // Compare works (by ISWC or genius_song_id or title, not by ID)
  console.log('📝 Comparing Works:');

  // Build map with multiple possible keys
  const workMap = new Map();
  for (const work of current.works) {
    if (work.iswc) workMap.set(`iswc:${work.iswc}`, work);
    if (work.genius_song_id) workMap.set(`genius:${work.genius_song_id}`, work);
    workMap.set(`title:${work.title.toLowerCase()}`, work);
  }

  const matchedWorks = new Set();

  for (const expected of snapshot.works) {
    let actual = null;

    // Try matching by ISWC first (most reliable)
    if (expected.iswc) {
      actual = workMap.get(`iswc:${expected.iswc}`);
    }

    // Try genius_song_id next
    if (!actual && expected.genius_song_id) {
      actual = workMap.get(`genius:${expected.genius_song_id}`);
    }

    // Fall back to title (case-insensitive)
    if (!actual) {
      actual = workMap.get(`title:${expected.title.toLowerCase()}`);
    }

    if (!actual) {
      console.error(`   ❌ Missing work: ${expected.title} (ISWC: ${expected.iswc || 'none'})`);
      hasErrors = true;
      continue;
    }

    matchedWorks.add(actual);

    // Compare key fields (skip 'id' and 'primary_artist_id' since IDs changed)
    const keyFields = ['title', 'iswc', 'iswc_source', 'genius_song_id', 'mbid'];
    for (const field of keyFields) {
      if (!compareField('work', 0, field, expected[field], actual[field], ignoreFields)) {
        console.error(`   ❌ Work "${expected.title}": ${field} mismatch`);
        console.error(`      Expected: ${JSON.stringify(expected[field])}`);
        console.error(`      Got:      ${JSON.stringify(actual[field])}`);
        hasErrors = true;
      }
    }
  }

  // Check for extra works
  const extraWorks = current.works.filter(w => !matchedWorks.has(w));
  if (extraWorks.length > 0) {
    for (const work of extraWorks) {
      console.error(`   ❌ Extra work: ${work.title} (ISWC: ${work.iswc || 'none'})`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`   ✅ All ${snapshot.works.length} works match`);
  }
  console.log('');

  // Compare recordings (by spotify_track_id, not by ID or work_id)
  console.log('🎵 Comparing Recordings:');
  const recordingMap = new Map(current.recordings.map(r => [r.spotify_track_id, r]));

  for (const expected of snapshot.recordings) {
    const actual = recordingMap.get(expected.spotify_track_id);

    if (!actual) {
      console.error(`   ❌ Missing recording: ${expected.title} (spotify: ${expected.spotify_track_id})`);
      hasErrors = true;
      continue;
    }

    // Compare key fields (skip 'id' and 'work_id' since IDs changed)
    const keyFields = ['spotify_track_id', 'title', 'spotify_url', 'apple_music_url'];
    for (const field of keyFields) {
      if (!compareField('recording', 0, field, expected[field], actual[field], ignoreFields)) {
        console.error(`   ❌ Recording "${expected.title}": ${field} mismatch`);
        console.error(`      Expected: ${JSON.stringify(expected[field])}`);
        console.error(`      Got:      ${JSON.stringify(actual[field])}`);
        hasErrors = true;
      }
    }

    recordingMap.delete(expected.spotify_track_id);
  }

  // Check for extra recordings
  if (recordingMap.size > 0) {
    for (const [spotifyId, recording] of recordingMap) {
      console.error(`   ❌ Extra recording: ${recording.title} (spotify: ${spotifyId})`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`   ✅ All ${snapshot.recordings.length} recordings match`);
  }
  console.log('');

  return !hasErrors;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('GRC-20 POPULATION REGRESSION TEST');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Step 1: Create snapshot
    const snapshot = await createSnapshot();

    // Step 2: Wipe tables
    runScript('scripts/migration/wipe-grc20-tables.ts', 'Wipe GRC-20 tables');

    // Step 3: Add constraints
    runScript('scripts/migration/add-grc20-constraints.ts', 'Add constraints');

    // Step 4: Populate artists
    runScript('scripts/migration/populate-grc20-artists.ts', 'Populate artists');

    // Step 5: Populate works
    runScript('scripts/migration/populate-grc20-works.ts', 'Populate works');

    // Step 6: Populate recordings
    runScript('scripts/migration/populate-grc20-recordings.ts', 'Populate recordings');

    // Step 7: Get current data
    const current = await getCurrentData();

    // Step 8: Compare
    const success = compareData(snapshot, current);

    // Step 9: Final report
    console.log('═'.repeat(80));
    if (success) {
      console.log('✅ REGRESSION TEST PASSED');
      console.log('');
      console.log('The refactored population scripts produce identical results!');
      console.log('');
      console.log('Summary:');
      console.log(`  - Artists: ${current.artists.length} (✅ matches snapshot)`);
      console.log(`  - Works: ${current.works.length} (✅ matches snapshot)`);
      console.log(`  - Recordings: ${current.recordings.length} (✅ matches snapshot)`);
    } else {
      console.log('❌ REGRESSION TEST FAILED');
      console.log('');
      console.log('Differences found between snapshot and repopulated data!');
      console.log('See details above.');
      process.exit(1);
    }
    console.log('═'.repeat(80));

  } catch (err) {
    console.error('');
    console.error('═'.repeat(80));
    console.error('❌ TEST FAILED WITH ERROR');
    console.error('═'.repeat(80));
    console.error(err);
    process.exit(1);
  }
}

main();
