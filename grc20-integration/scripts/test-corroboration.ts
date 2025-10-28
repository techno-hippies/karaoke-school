/**
 * Test Corroborated Artist Data
 *
 * Validates that grc20_artists table produces high-quality GRC-20 entities
 * WITHOUT attempting to mint (no wallet required)
 */

import postgres from 'postgres';
import { config } from '../config';
import { fetchAndValidateArtists } from '../utils/db-to-grc20-mapper';

async function main() {
  console.log('🧪 Testing Corroborated Artist Data\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // Test with top 10 ready-to-mint artists
    const BATCH_SIZE = 10;
    console.log(`🔍 Fetching top ${BATCH_SIZE} ready-to-mint artists...\n`);

    const result = await fetchAndValidateArtists(sql, BATCH_SIZE);

    console.log('\n📋 Sample Artists:');
    result.valid.slice(0, 5).forEach((artist, i) => {
      console.log(`\n${i + 1}. ${artist.name}`);
      console.log(`   Genius: ${artist.geniusId}, Spotify: ${artist.spotifyId || 'N/A'}`);
      console.log(`   MBID: ${artist.mbid || 'N/A'}, ISNI: ${artist.isni || 'N/A'}`);
      console.log(`   Image: ${artist.imageUrl ? '✅' : '❌'}`);
      console.log(`   Social: Instagram=${!!artist.instagramHandle}, Twitter=${!!artist.twitterHandle}, TikTok=${!!artist.tiktokHandle}`);
    });

    if (result.invalid.length > 0) {
      console.log('\n⚠️  Invalid Artists:');
      result.invalid.forEach(({ item, errors }) => {
        console.log(`\n   ${item.name}:`);
        errors.forEach(err => console.log(`      - ${err}`));
      });
    }

    console.log('\n✅ Corroboration Quality Check Complete');
    console.log(`   ${result.stats.validPercent}% validation pass rate`);
    console.log(`   ${result.stats.validCount}/${result.stats.total} artists ready for blockchain mint`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
