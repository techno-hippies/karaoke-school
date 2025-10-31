#!/usr/bin/env bun
/**
 * Cleanup Script: Remove percentages from language_data
 *
 * Usage:
 *   dotenvx run -f .env -- bun cleanup-language-data.ts
 */

import { query, transaction, close } from '../../src/db/neon';

async function main() {
  console.log('🧹 Cleaning up language_data to remove percentages...\n');

  // Get all records with language_data
  const records = await query<{
    spotify_track_id: string;
    language_data: any;
  }>(`
    SELECT spotify_track_id, language_data
    FROM song_lyrics
    WHERE language_data IS NOT NULL
  `);

  console.log(`📊 Found ${records.length} records with language_data`);

  if (records.length === 0) {
    console.log('✅ Nothing to clean!');
    await close();
    return;
  }

  // Transform data to remove breakdown/percentages
  const updates: Array<{ spotify_track_id: string; language_data: any }> = records.map((record) => {
    const data = record.language_data;

    // Only keep: primary, detectedLanguages, confidence
    const cleaned = {
      primary: data.primary,
      detectedLanguages: data.detectedLanguages || (data.breakdown ? data.breakdown.map((b: any) => b.code) : [data.primary]),
      confidence: data.confidence,
    };

    return {
      spotify_track_id: record.spotify_track_id,
      language_data: cleaned,
    };
  });

  console.log(`🔄 Updating ${updates.length} records...\n`);

  try {
    // Execute updates one at a time
    let updated = 0;
    for (const record of updates) {
      const dataJson = JSON.stringify(record.language_data);
      // Escape single quotes for SQL
      const escapedJson = dataJson.replace(/'/g, "''");
      const sql = `
        UPDATE song_lyrics
        SET language_data = '${escapedJson}'::jsonb
        WHERE spotify_track_id = '${record.spotify_track_id}';
      `;

      await query(sql);
      updated++;

      if (updated % 5 === 0) {
        console.log(`✅ Updated ${updated}/${updates.length} records`);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`📊 Summary: ${updated} records cleaned`);
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
