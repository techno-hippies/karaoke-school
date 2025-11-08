#!/usr/bin/env bun
/**
 * Processor: Enrich Wikidata Work Contributors
 * Extracts work contributor Wikidata IDs from Quansic raw_data and enriches them
 *
 * Usage:
 *   bun src/processors/enrich-wikidata-work-contributors.ts [batchSize]
 */

import { query, close } from '../db/neon';
import { getWikidataEntity } from '../services/wikidata';

interface WorkContributor {
  iswc: string | null;
  work_title: string;
  contributor_name: string;
  wikidata_id: string;
  role: string;
  isrc: string;
}

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 50;

  console.log('🌐 Wikidata Work Contributors Enrichment');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find work contributors from Quansic with Wikidata IDs
  console.log('⏳ Finding work contributors with Wikidata IDs...');

  const contributorsToProcess = await query<WorkContributor>(`
    WITH work_contributors AS (
      SELECT DISTINCT
        qr.isrc,
        qr.iswc,
        work->>'title' as work_title,
        contributor->>'name' as contributor_name,
        contributor->>'role' as role,
        contributor->'ids'->'wikidataIds'->>0 as wikidata_id
      FROM quansic_recordings qr,
        jsonb_array_elements(qr.raw_data->'works') as work,
        jsonb_array_elements(work->'contributors') as contributor
      WHERE qr.raw_data->'works' IS NOT NULL
        AND contributor->'ids'->'wikidataIds' IS NOT NULL
        AND jsonb_array_length(contributor->'ids'->'wikidataIds') > 0
    )
    SELECT DISTINCT
      wc.iswc,
      wc.work_title,
      wc.contributor_name,
      wc.wikidata_id,
      wc.role,
      wc.isrc
    FROM work_contributors wc
    LEFT JOIN wikidata_artists wa ON wc.wikidata_id = wa.wikidata_id
    WHERE wa.wikidata_id IS NULL
      AND wc.wikidata_id IS NOT NULL
    ORDER BY wc.work_title, wc.contributor_name
    LIMIT ${batchSize}
  `);

  if (contributorsToProcess.length === 0) {
    console.log('✅ No work contributors need Wikidata enrichment. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${contributorsToProcess.length} work contributors to process`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const contributor of contributorsToProcess) {
    const { wikidata_id, contributor_name, work_title, role, iswc, isrc } = contributor;

    console.log(`\n🔍 ${contributor_name} (${wikidata_id})`);
    console.log(`   Work: ${work_title}${iswc ? ` (${iswc})` : ''}`);
    console.log(`   Role: ${role}`);

    try {
      // Fetch from Wikidata API
      console.log(`   Fetching from Wikidata API...`);
      const wikidataEntity = await getWikidataEntity(wikidata_id);

      if (!wikidataEntity) {
        console.log(`   ⚠️  Not found on Wikidata`);
        skippedCount++;
        continue;
      }

      // Extract artist data from entity
      const labels = wikidataEntity.labels || {};
      const claims = wikidataEntity.claims || {};

      // Get VIAF, GND, LOC IDs
      const viafId = claims.P214?.[0]?.mainsnak?.datavalue?.value || null;
      const gndId = claims.P227?.[0]?.mainsnak?.datavalue?.value || null;
      const locId = claims.P244?.[0]?.mainsnak?.datavalue?.value || null;

      // Get occupation (P106)
      const occupations = (claims.P106 || [])
        .map((claim: any) => claim.mainsnak?.datavalue?.value?.id)
        .filter(Boolean);

      // Get ISNI (P213)
      const isnis = (claims.P213 || [])
        .map((claim: any) => claim.mainsnak?.datavalue?.value)
        .filter(Boolean);

      // Get MusicBrainz artist ID (P434)
      const mbids = (claims.P434 || [])
        .map((claim: any) => claim.mainsnak?.datavalue?.value)
        .filter(Boolean);

      console.log(`   ✅ Name: ${wikidataEntity.labels?.en?.value || contributor_name}`);
      if (viafId) console.log(`   ✅ VIAF: ${viafId}`);
      if (gndId) console.log(`   ✅ GND: ${gndId}`);
      if (locId) console.log(`   ✅ LOC: ${locId}`);
      if (isnis.length > 0) console.log(`   ✅ ISNI: ${isnis[0]}`);
      if (occupations.length > 0) console.log(`   ✅ Occupations: ${occupations.length}`);

      const labelCount = Object.keys(labels).length;
      if (labelCount > 0) {
        console.log(`   ✅ Labels in ${labelCount} languages`);
      }

      // Upsert to wikidata_artists table
      await query(`
        INSERT INTO wikidata_artists (
          wikidata_id,
          viaf_id,
          gnd_id,
          loc_id,
          labels,
          identifiers,
          enriched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (wikidata_id) DO UPDATE SET
          viaf_id = COALESCE(EXCLUDED.viaf_id, wikidata_artists.viaf_id),
          gnd_id = COALESCE(EXCLUDED.gnd_id, wikidata_artists.gnd_id),
          loc_id = COALESCE(EXCLUDED.loc_id, wikidata_artists.loc_id),
          labels = COALESCE(EXCLUDED.labels, wikidata_artists.labels),
          identifiers = COALESCE(EXCLUDED.identifiers, wikidata_artists.identifiers),
          enriched_at = NOW()
      `, [
        wikidata_id,
        viafId,
        gndId,
        locId,
        JSON.stringify(labels),
        JSON.stringify({
          occupations,
          isnis,
          mbids,
        }),
      ]);

      console.log(`   ✅ SAVED to wikidata_artists`);
      successCount++;

      // Rate limit: 1 request/second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failedCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log(`   Total processed: ${contributorsToProcess.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('═══════════════════════════════════════');
  console.log('');

  // Show final stats
  const stats = await query(`
    SELECT
      COUNT(DISTINCT wa.wikidata_id) as total_contributors,
      COUNT(DISTINCT wc.work_title) as unique_works,
      COUNT(DISTINCT wc.iswc) FILTER (WHERE wc.iswc IS NOT NULL) as works_with_iswc
    FROM (
      SELECT DISTINCT
        work->>'title' as work_title,
        qr.iswc,
        contributor->'ids'->'wikidataIds'->>0 as wikidata_id
      FROM quansic_recordings qr,
        jsonb_array_elements(qr.raw_data->'works') as work,
        jsonb_array_elements(work->'contributors') as contributor
      WHERE qr.raw_data->'works' IS NOT NULL
        AND contributor->'ids'->'wikidataIds' IS NOT NULL
        AND jsonb_array_length(contributor->'ids'->'wikidataIds') > 0
    ) wc
    JOIN wikidata_artists wa ON wc.wikidata_id = wa.wikidata_id
  `);

  if (stats.length > 0) {
    console.log('📈 COVERAGE STATS:');
    console.log(`   Work contributors enriched: ${stats[0].total_contributors}`);
    console.log(`   Unique works represented: ${stats[0].unique_works}`);
    console.log(`   Works with ISWC: ${stats[0].works_with_iswc}`);
    console.log('');
  }

  await close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
