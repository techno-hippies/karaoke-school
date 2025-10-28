#!/usr/bin/env bun
/**
 * Test Tiered Validation System
 * 
 * Tests the new tiered validation approach on current artist data
 */

import postgres from 'postgres';
import { config } from '../config';
import { 
  validateBatchByTier, 
  ValidationTiers, 
  checkQualityGates,
  detectValidationTier 
} from '../types/tiered-validation-schemas';

async function main() {
  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    console.log('🧪 Testing Tiered Validation System\n');

    // Get sample artists from database
    const artists = await sql`
      SELECT 
        id,
        name,
        genius_artist_id as "geniusId",
        mbid,
        spotify_artist_id as "spotifyId",
        wikidata_id as "wikidataId",
        discogs_id as "discogsId",
        isni,
        ipi,
        instagram_handle as "instagramHandle",
        tiktok_handle as "tiktokHandle",
        twitter_handle as "twitterHandle",
        facebook_handle as "facebookHandle",
        youtube_channel as "youtubeChannel",
        soundcloud_handle as "soundcloudHandle",
        image_url as "imageUrl",
        genius_url as "geniusUrl",
        spotify_url as "spotifyUrl"
      FROM grc20_artists 
      LIMIT 50
    `;

    console.log(`📊 Testing ${artists.length} artists against validation tiers\n`);

    // Test each tier
    for (const [tierName, tierConfig] of Object.entries(ValidationTiers)) {
      const result = validateBatchByTier(artists, tierName);
      
      console.log(`${tierConfig.color} ${tierConfig.name} Tier:`);
      console.log(`   Pass Rate: ${result.stats.validPercent}% (${result.stats.validCount}/${result.stats.total})`);
      console.log(`   Requirements: ${tierConfig.min_external_ids}+ external IDs, ${tierConfig.min_social_links}+ social links`);
      console.log(`   ISNI Required: ${tierConfig.isni_required ? 'Yes' : 'No'}\n`);
    }

    // Show tier distribution
    console.log('📈 Tier Distribution:');
    const tierCounts = { PREMIUM: 0, STANDARD: 0, MINIMAL: 0, INVALID: 0 };
    
    for (const artist of artists) {
      const tier = detectValidationTier(artist);
      const gateResult = checkQualityGates(artist);
      
      if (gateResult.passed) {
        tierCounts[tier]++;
      } else {
        tierCounts.INVALID++;
      }
    }

    for (const [tier, count] of Object.entries(tierCounts)) {
      const config = ValidationTiers[tier];
      if (config) {
        console.log(`   ${config.color} ${config.name}: ${count} artists`);
      } else {
        console.log(`   ❌ Invalid: ${count} artists`);
      }
    }

    // Show sample validation failures
    console.log('\n🔍 Sample Validation Issues:');
    let issueCount = 0;
    
    for (const artist of artists) {
      const gateResult = checkQualityGates(artist);
      if (!gateResult.passed && issueCount < 5) {
        console.log(`   ${artist.name}: ${gateResult.recommendation}`);
        issueCount++;
      }
    }

  } catch (error) {
    console.error('❌ Validation test failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
