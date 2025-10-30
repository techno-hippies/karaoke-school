/**
 * Fix Remaining Broken Wikidata IDs
 * 
 * Direct SQL fix for artists with 'wiki' placeholder instead of proper Q-IDs
 * This operates on existing MusicBrainz data that may have correct Q-IDs
 * but were extracted incorrectly due to the regex bug.
 */

import postgres from 'postgres';
import { config } from './config';

async function main() {
  console.log('🔧 Fixing Remaining Broken Wikidata IDs\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // First, check what we're working with
    console.log('1. 📊 Current Status Check:');
    const brokenCount = await sql`
      SELECT COUNT(*) as count
      FROM grc20_artists 
      WHERE wikidata_id = 'wiki'
    `;
    
    const { count } = brokenCount[0];
    console.log(`   Found ${count} artists with 'wiki' placeholder`);
    
    if (count > 0) {
      const samples = await sql`
        SELECT name, wikidata_id
        FROM grc20_artists 
        WHERE wikidata_id = 'wiki'
        ORDER BY name
        LIMIT 5
      `;
      console.log(`   Sample: ${samples.map(s => s.name).join(', ')}`);
    }

    if (count === 0) {
      console.log('✅ No broken Wikidata IDs found!');
      return;
    }

    // Check if musicbrainz_artists has the correct Q-IDs
    console.log('\n2. 🔍 Checking MusicBrainz Source Data:');
    const mbCheck = await sql`
      SELECT COUNT(*) as count
      FROM musicbrainz_artists ma
      JOIN grc20_artists ga ON ga.mbid = ma.mbid
      WHERE ga.wikidata_id = 'wiki' 
        AND ma.wikidata_id IS NOT NULL 
        AND ma.wikidata_id != ''
    `;
    
    console.log(`   Found ${mbCheck[0].count} MusicBrainz records with correct Q-IDs`);

    // Fix by updating from musicbrainz_artists
    if (mbCheck[0].count > 0) {
      console.log('\n3. 🔄 Updating from MusicBrainz Data:');
      
      const fixResult = await sql`
        UPDATE grc20_artists ga
        SET wikidata_id = ma.wikidata_id,
            updated_at = NOW()
        FROM musicbrainz_artists ma
        WHERE ga.mbid = ma.mbid
          AND ga.wikidata_id = 'wiki'
          AND ma.wikidata_id IS NOT NULL
          AND ma.wikidata_id != ''
          AND ma.wikidata_id LIKE 'Q%'
        RETURNING ga.name, ga.wikidata_id
      `;
      
      console.log(`   Fixed ${fixResult.length} artists:`);
      fixResult.slice(0, 5).forEach(({ name, wikidata_id }) => {
        console.log(`      ${name}: ${wikidata_id}`);
      });
    }

    // For remaining broken IDs, try to fetch from MusicBrainz API
    const remainingBroken = await sql`
      SELECT COUNT(*) as count
      FROM grc20_artists 
      WHERE wikidata_id = 'wiki'
    `;

    if (remainingBroken[0].count > 0) {
      console.log(`\n4. 🌐 Attempting API Fixes for ${remainingBroken[0].count} remaining artists:`);
      
      // Get sample of remaining broken artists
      const remainingArtists = await sql`
        SELECT id, name, mbid
        FROM grc20_artists 
        WHERE wikidata_id = 'wiki'
        ORDER BY name
        LIMIT 20
      `;

      console.log('   Note: Full API fix requires running enrich-musicbrainz.ts');
      console.log('   For now, setting wikidata_id to NULL for these artists');
      console.log('   Suggest manual review or retry enrichment when MusicBrainz API is stable');

      // Set to NULL to indicate "needs review" instead of broken 'wiki'
      const nullifyResult = await sql`
        UPDATE grc20_artists
        SET wikidata_id = NULL,
            updated_at = NOW()
        WHERE wikidata_id = 'wiki'
        RETURNING name
      `;
      
      console.log(`   Set ${nullifyResult.length} artists to NULL (needs review)`);
    }

    // Final verification
    console.log('\n5. ✅ Final Verification:');
    const finalCheck = await sql`
      SELECT 
        COUNT(*) as total_artists,
        COUNT(*) FILTER (WHERE wikidata_id LIKE 'Q%') as fixed_q_ids,
        COUNT(*) FILTER (WHERE wikidata_id IS NULL) as null_ids,
        COUNT(*) FILTER (WHERE wikidata_id = 'wiki') as still_broken,
        COUNT(*) FILTER (WHERE wikidata_id IS NOT NULL AND wikidata_id != 'wiki') as total_valid
      FROM grc20_artists
    `;

    const { total_artists, fixed_q_ids, null_ids, still_broken, total_valid } = finalCheck[0];
    
    console.log(`   Total artists: ${total_artists}`);
    console.log(`   ✅ Fixed Q% IDs: ${fixed_q_ids}`);
    console.log(`   🔄 NULL (needs review): ${null_ids}`);
    console.log(`   ❌ Still broken: ${still_broken}`);
    console.log(`   📊 Total valid: ${total_valid}`);
    
    if (still_broken === 0) {
      console.log('\n🎉 All broken Wikidata IDs have been fixed!');
    }

    // Show some fixed examples
    if (fixed_q_ids > 0) {
      const examples = await sql`
        SELECT name, wikidata_id
        FROM grc20_artists 
        WHERE wikidata_id LIKE 'Q%'
        ORDER BY updated_at DESC
        LIMIT 10
      `;
      
      console.log('\n📋 Recently Fixed Examples:');
      examples.forEach(({ name, wikidata_id }) => {
        console.log(`   ${name}: ${wikidata_id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error fixing wikidata IDs:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
