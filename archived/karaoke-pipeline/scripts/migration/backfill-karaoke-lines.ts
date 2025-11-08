/**
 * Backfill karaoke_lines from existing lyrics_translations
 * 
 * This script:
 * 1. Queries all lyrics_translations (language-agnostic line structure)
 * 2. Extracts lines from JSONB array
 * 3. Inserts into karaoke_lines (one line per row)
 * 4. Trigger auto-computes segment_hash
 * 
 * Run with:
 *   bun run scripts/migration/backfill-karaoke-lines.ts
 */

import { db } from '../../src/lib/db'
import { sql } from 'kysely'

interface TranslationLine {
  lineIndex: number
  start: number // seconds (float)
  end: number   // seconds (float)
  originalText: string
  words: Array<{
    text: string
    start: number // seconds
    end: number   // seconds
  }>
}

interface LyricsTranslation {
  spotify_track_id: string
  language_code: string
  lines: TranslationLine[]
}

async function main() {
  console.log('[Backfill] Starting karaoke_lines backfill...')

  // Step 1: Get all unique tracks with translations (pick one language per track)
  console.log('[Backfill] Finding tracks with translations...')
  
  const tracksWithTranslations = await db
    .selectFrom('lyrics_translations as lt')
    .select(['lt.spotify_track_id', 'lt.language_code', 'lt.lines'])
    .distinctOn('lt.spotify_track_id')
    .orderBy('lt.spotify_track_id')
    .orderBy('lt.language_code') // Pick first language alphabetically (doesn't matter)
    .execute()

  console.log(`[Backfill] Found ${tracksWithTranslations.length} tracks with translations`)

  // Step 2: Process each track
  let totalLinesInserted = 0
  let tracksFailed = 0

  for (const translation of tracksWithTranslations) {
    try {
      const { spotify_track_id, lines } = translation

      if (!lines || !Array.isArray(lines)) {
        console.warn(`[Backfill] ⚠️  Skipping ${spotify_track_id}: invalid lines data`)
        tracksFailed++
        continue
      }

      console.log(`[Backfill] Processing ${spotify_track_id} (${lines.length} lines)...`)

      // Step 3: Insert lines for this track
      const linesToInsert = lines.map((line) => ({
        spotify_track_id,
        line_index: line.lineIndex,
        start_ms: Math.round(line.start * 1000), // Convert seconds to milliseconds
        end_ms: Math.round(line.end * 1000),
        original_text: line.originalText,
        word_count: line.words?.length || 0,
        words: JSON.stringify(line.words || []),
        alignment_source: 'elevenlabs',
      }))

      // Batch insert
      await db
        .insertInto('karaoke_lines')
        .values(linesToInsert)
        .onConflict((oc) =>
          oc.columns(['spotify_track_id', 'line_index']).doUpdateSet({
            start_ms: sql`excluded.start_ms`,
            end_ms: sql`excluded.end_ms`,
            original_text: sql`excluded.original_text`,
            word_count: sql`excluded.word_count`,
            words: sql`excluded.words`,
            updated_at: sql`NOW()`,
          })
        )
        .execute()

      totalLinesInserted += lines.length
      console.log(`[Backfill] ✓ Inserted ${lines.length} lines for ${spotify_track_id}`)
    } catch (error) {
      console.error(`[Backfill] ❌ Failed to process ${translation.spotify_track_id}:`, error)
      tracksFailed++
    }
  }

  // Step 4: Summary
  console.log('\n[Backfill] ============ SUMMARY ============')
  console.log(`[Backfill] Total tracks processed: ${tracksWithTranslations.length}`)
  console.log(`[Backfill] Total lines inserted: ${totalLinesInserted}`)
  console.log(`[Backfill] Tracks failed: ${tracksFailed}`)

  // Step 5: Verify segment associations
  console.log('\n[Backfill] Checking segment associations...')
  
  const stats = await db
    .selectFrom('karaoke_lines')
    .select([
      sql<number>`COUNT(*)`.as('total_lines'),
      sql<number>`COUNT(segment_hash)`.as('lines_with_segment'),
      sql<number>`COUNT(*) FILTER (WHERE segment_hash IS NULL)`.as('lines_without_segment'),
    ])
    .executeTakeFirst()

  console.log('[Backfill] Segment association stats:')
  console.log(`  - Total lines: ${stats?.total_lines}`)
  console.log(`  - Lines with segment: ${stats?.lines_with_segment}`)
  console.log(`  - Lines without segment: ${stats?.lines_without_segment}`)

  if (stats?.lines_without_segment && stats.lines_without_segment > 0) {
    console.log('\n[Backfill] ⚠️  Some lines are not associated with segments.')
    console.log('[Backfill] This is expected if:')
    console.log('  1. Lines extend beyond segment boundaries')
    console.log('  2. Segment timing is not yet set (optimal_segment_start_ms IS NULL)')
    console.log('  3. Lines were added for tracks without karaoke segments')
  }

  console.log('\n[Backfill] ✓ Backfill complete!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Backfill] Fatal error:', error)
    process.exit(1)
  })
