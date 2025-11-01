/**
 * Backfill ISWCs for grc20_works that don't have them
 *
 * Strategy:
 * 1. Find all works in grc20_works without ISWCs
 * 2. For each work, get the Spotify track ISRC
 * 3. Try BMI (title + performer)
 * 4. If BMI fails, try MLC (ISRC + title + artist)
 * 5. Update grc20_works if ISWC found
 */

import { query } from '../../src/db/neon';
import { searchBMI, checkBMIHealth } from '../../src/services/bmi';
import { searchMLC, checkMLCHealth } from '../../src/services/mlc';

interface WorkToBackfill {
  id: number;
  title: string;  // Spotify title (proper case)
  primary_artist_name: string;
  spotify_track_id: string | null;
  isrc: string | null;
}

async function getWorksNeedingISWC(): Promise<WorkToBackfill[]> {
  // Get works without ISWCs, joining with spotify_tracks to get ISRC
  const results = await query(`
    SELECT DISTINCT
      w.id,
      w.title,
      w.primary_artist_name,
      st.spotify_track_id,
      st.isrc
    FROM grc20_works w
    LEFT JOIN spotify_tracks st ON st.title = w.title
      AND (st.artists->0->>'name') = w.primary_artist_name
    WHERE w.iswc IS NULL
    ORDER BY w.id
  `);

  return results as WorkToBackfill[];
}

async function saveBMIWork(bmiData: any, spotifyTitle: string): Promise<void> {
  await query(`
    INSERT INTO bmi_works (
      iswc, title, bmi_work_id, ascap_work_id,
      writers, publishers, performers, shares, status, raw_data
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (iswc) DO UPDATE SET
      title = EXCLUDED.title,
      bmi_work_id = EXCLUDED.bmi_work_id,
      ascap_work_id = EXCLUDED.ascap_work_id,
      writers = EXCLUDED.writers,
      publishers = EXCLUDED.publishers,
      performers = EXCLUDED.performers,
      shares = EXCLUDED.shares,
      status = EXCLUDED.status,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
  `, [
    bmiData.iswc,
    spotifyTitle,  // Use Spotify title, not BMI's ALL CAPS title
    bmiData.bmi_work_id,
    bmiData.ascap_work_id,
    JSON.stringify(bmiData.writers || []),
    JSON.stringify(bmiData.publishers || []),
    JSON.stringify(bmiData.performers || []),
    JSON.stringify(bmiData.shares || {}),
    bmiData.status,
    JSON.stringify(bmiData),
  ]);
}

async function saveMLCWork(mlcData: any, spotifyTitle: string): Promise<void> {
  await query(`
    INSERT INTO mlc_works (
      isrc, mlc_song_code, iswc, title,
      writers, publishers, total_publisher_share, raw_data
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (isrc) DO UPDATE SET
      mlc_song_code = EXCLUDED.mlc_song_code,
      iswc = EXCLUDED.iswc,
      title = EXCLUDED.title,
      writers = EXCLUDED.writers,
      publishers = EXCLUDED.publishers,
      total_publisher_share = EXCLUDED.total_publisher_share,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
  `, [
    mlcData.isrc,
    mlcData.mlc_song_code,
    mlcData.iswc,
    spotifyTitle,  // Use Spotify title, not MLC's ALL CAPS title
    JSON.stringify(mlcData.writers || []),
    JSON.stringify(mlcData.publishers || []),
    mlcData.total_publisher_share || 0,
    JSON.stringify(mlcData),
  ]);
}

async function main() {
  console.log('🔍 Backfilling ISWCs for grc20_works...\n');

  // Check service health
  console.log('🏥 Checking service health...');
  const bmiHealthy = await checkBMIHealth();
  const mlcHealthy = await checkMLCHealth();

  console.log(`   BMI: ${bmiHealthy ? '✅' : '❌'}`);
  console.log(`   MLC: ${mlcHealthy ? '✅' : '❌'}`);
  console.log('');

  if (!bmiHealthy && !mlcHealthy) {
    console.error('❌ Both BMI and MLC services are down. Exiting.');
    process.exit(1);
  }

  // Get works needing ISWCs
  const works = await getWorksNeedingISWC();
  console.log(`📊 Found ${works.length} works without ISWCs\n`);

  let bmiFound = 0;
  let mlcFound = 0;
  let notFound = 0;

  for (const work of works) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎵 ${work.title} - ${work.primary_artist_name}`);
    console.log(`   Work ID: ${work.id}`);
    console.log(`   Spotify Track ID: ${work.spotify_track_id || 'N/A'}`);
    console.log(`   ISRC: ${work.isrc || 'N/A'}`);

    let found = false;

    // Try BMI first (simpler, faster)
    if (bmiHealthy) {
      const bmiResult = await searchBMI(work.title, work.primary_artist_name);

      if (bmiResult && bmiResult.iswc) {
        console.log(`   ✅ Found ISWC in BMI: ${bmiResult.iswc}`);
        console.log(`   💾 Saving to bmi_works table (using Spotify title: "${work.title}")...`);
        await saveBMIWork(bmiResult, work.title);  // Pass Spotify title
        bmiFound++;
        found = true;
        continue;
      }
    }

    // Try MLC if BMI didn't find it (requires ISRC)
    if (!found && mlcHealthy && work.isrc) {
      const mlcResult = await searchMLC(
        work.isrc,
        work.title,
        work.primary_artist_name
      );

      if (mlcResult && mlcResult.iswc) {
        console.log(`   ✅ Found ISWC in MLC: ${mlcResult.iswc}`);
        console.log(`   💾 Saving to mlc_works table (using Spotify title: "${work.title}")...`);
        await saveMLCWork(mlcResult, work.title);  // Pass Spotify title
        mlcFound++;
        found = true;
        continue;
      }
    }

    // If neither found it
    if (!found) {
      if (!work.isrc) {
        console.log(`   ⚠️  Cannot search MLC: No ISRC available`);
      }
      console.log(`   ❌ ISWC not found in BMI or MLC`);
      notFound++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 Backfill Summary:');
  console.log(`   Total works processed: ${works.length}`);
  console.log(`   Found in BMI: ${bmiFound}`);
  console.log(`   Found in MLC: ${mlcFound}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Success rate: ${Math.round((bmiFound + mlcFound) / works.length * 100)}%`);

  // Check BMI/MLC tables
  const bmiCount = await query(`SELECT COUNT(*) as count FROM bmi_works`);
  const mlcCount = await query(`SELECT COUNT(*) as count FROM mlc_works`);

  console.log(`\n📦 Cache Tables:`);
  console.log(`   bmi_works: ${bmiCount[0].count} works`);
  console.log(`   mlc_works: ${mlcCount[0].count} works`);

  if (bmiFound > 0 || mlcFound > 0) {
    console.log(`\n📝 Next step: Re-run populate-grc20-works.ts to pull ISWCs from bmi_works and mlc_works`);
    console.log(`   bun scripts/migration/populate-grc20-works.ts`);
  }

  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
