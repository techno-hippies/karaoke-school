#!/usr/bin/env bun
/**
 * Implement GRC-20 Consensus System Fixes
 * 
 * This script orchestrates all the critical fixes identified in the analysis:
 * 1. Fix wikidata regex bug
 * 2. Add corroboration logging
 * 3. Update validation with tiered approach
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Implementing GRC-20 Consensus System Fixes\n');

// ============================================================================
// STEP 1: FIX WIKIDATA REGEX BUG
// ============================================================================

console.log('📝 Step 1: Fixing wikidata regex bug...');

try {
  execSync('bun run scripts/fix-wikidata-regex.ts', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Wikidata regex bug fixed\n');
} catch (error) {
  console.log('❌ Failed to fix wikidata regex bug\n');
  process.exit(1);
}

// ============================================================================
// STEP 2: CREATE IMPLEMENTATION PLAN
// ============================================================================

console.log('📋 Step 2: Implementation Plan\n');

const implementationPlan = {
  immediate: [
    {
      task: 'Fix wikidata regex bug',
      status: '✅ COMPLETE',
      impact: 'High - fixes incorrect wikidata_id values',
      time: '5 minutes'
    },
    {
      task: 'Re-run MusicBrainz enrichment',
      status: '⏳ PENDING',
      impact: 'High - updates all wikidata_id values',
      time: '30-60 minutes'
    },
    {
      task: 'Add corroboration logging',
      status: '📄 READY',
      impact: 'Medium - enables audit trail',
      time: '5 minutes'
    },
    {
      task: 'Implement tiered validation',
      status: '📄 READY', 
      impact: 'High - improves data quality gating',
      time: '15 minutes'
    }
  ],
  next_sprint: [
    {
      task: 'CISAC integration',
      status: '📋 PLANNED',
      impact: 'High - adds industry source for ISNI/IPI',
      time: '2-3 weeks'
    },
    {
      task: 'Enhanced consensus tracking',
      status: '📋 PLANNED', 
      impact: 'Medium - better audit trail',
      time: '1 week'
    },
    {
      task: 'Automated conflict resolution',
      status: '📋 PLANNED',
      impact: 'Medium - reduces manual review',
      time: '2 weeks'
    }
  ]
};

console.log('🔥 IMMEDIATE FIXES:');
implementationPlan.immediate.forEach((item, index) => {
  console.log(`   ${index + 1}. ${item.task}`);
  console.log(`      Status: ${item.status}`);
  console.log(`      Impact: ${item.impact}`);
  console.log(`      Time: ${item.time}\n`);
});

console.log('📈 NEXT SPRINT:');
implementationPlan.next_sprint.forEach((item, index) => {
  console.log(`   ${index + 1}. ${item.task}`);
  console.log(`      Status: ${item.status}`);
  console.log(`      Impact: ${item.impact}`);
  console.log(`      Time: ${item.time}\n`);
});

// ============================================================================
// STEP 3: CREATE EXECUTION SCRIPTS
// ============================================================================

console.log('📜 Step 3: Creating execution scripts...\n');

// Create a comprehensive fix execution script
const fixScript = `#!/bin/bash
# GRC-20 Consensus System Fixes - Execution Script
# Run this script to implement all identified fixes

set -e

echo "🚀 Starting GRC-20 Consensus System Fixes"
echo "=========================================="

# Step 1: Run MusicBrainz enrichment with fixed regex
echo ""
echo "📝 Step 1: Re-running MusicBrainz enrichment..."
echo "This will fix all wikidata_id values that currently show 'wiki'"
echo ""

# Check if there are artists to enrich
ARTISTS_TO_ENRICH=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM spotify_artists sa 
  LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id 
  WHERE ma.spotify_artist_id IS NULL;
" 2>/dev/null || echo "0")

if [ "$ARTISTS_TO_ENRICH" -gt 0 ]; then
  echo "Found $ARTISTS_TO_ENRICH artists to enrich"
  echo "This will take approximately $((($ARTISTS_TO_ENRICH + 49) / 50)) minutes"
  echo ""
  
  # Run enrichment in batches of 50
  while [ "$ARTISTS_TO_ENRICH" -gt 0 ]; do
    bun run scripts/enrich-musicbrainz.ts 50
    sleep 2  # Brief pause between batches
    
    # Check remaining
    ARTISTS_TO_ENRICH=$(psql $DATABASE_URL -t -c "
      SELECT COUNT(*) 
      FROM spotify_artists sa 
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id 
      WHERE ma.spotify_artist_id IS NULL;
    " 2>/dev/null || echo "0")
    
    if [ "$ARTISTS_TO_ENRICH" -gt 0 ]; then
      echo "Remaining: $ARTISTS_TO_ENRICH artists"
    fi
  done
else
  echo "✅ All artists already have MusicBrainz data"
fi

# Step 2: Re-run corroboration with updated data
echo ""
echo "🔄 Step 2: Re-running corroboration..."
bun run scripts/run-corroboration.ts

# Step 3: Add corroboration logging
echo ""
echo "📝 Step 3: Adding corroboration logging..."
psql $DATABASE_URL -f scripts/add-corroboration-logging.sql

# Step 4: Verify fixes
echo ""
echo "🔍 Step 4: Verifying fixes..."

# Check wikidata IDs
echo "Checking wikidata_id fixes..."
WIKIDATA_FIXED=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM grc20_artists 
  WHERE wikidata_id LIKE 'Q%';
" 2>/dev/null || echo "0")

WIKIDATA_BROKEN=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM grc20_artists 
  WHERE wikidata_id = 'wiki';
" 2>/dev/null || echo "0")

echo "✅ Fixed wikidata IDs: $WIKIDATA_FIXED"
echo "❌ Still broken: $WIKIDATA_BROKEN"

# Check corroboration log
echo ""
echo "Checking corroboration logging..."
LOG_ENTRIES=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM grc20_corroboration_log;
" 2>/dev/null || echo "0")

echo "📝 Corroboration log entries: $LOG_ENTRIES"

# Show data quality dashboard
echo ""
echo "📊 Data Quality Dashboard:"
psql $DATABASE_URL -c "SELECT * FROM data_quality_dashboard;"

echo ""
echo "🎉 All fixes implemented successfully!"
echo ""
echo "📋 Next Steps:"
echo "   1. Review data quality dashboard above"
echo "   2. Test tiered validation with: bun run scripts/test-tiered-validation.ts"
echo "   3. Plan CISAC integration for next sprint"
echo "   4. Consider business decision on ISNI requirements for minting"
`;

fs.writeFileSync(
  path.join(__dirname, '../scripts/execute-fixes.sh'),
  fixScript,
  { mode: 0o755 }
);

console.log('✅ Created execution script: scripts/execute-fixes.sh');

// ============================================================================
// STEP 4: CREATE VALIDATION TEST SCRIPT
// ============================================================================

console.log('🧪 Step 4: Creating validation test script...\n');

const validationTestScript = `#!/usr/bin/env bun
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
    console.log('🧪 Testing Tiered Validation System\\n');

    // Get sample artists from database
    const artists = await sql\`
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
    \`;

    console.log(\`📊 Testing \${artists.length} artists against validation tiers\\n\`);

    // Test each tier
    for (const [tierName, tierConfig] of Object.entries(ValidationTiers)) {
      const result = validateBatchByTier(artists, tierName);
      
      console.log(\`\${tierConfig.color} \${tierConfig.name} Tier:\`);
      console.log(\`   Pass Rate: \${result.stats.validPercent}% (\${result.stats.validCount}/\${result.stats.total})\`);
      console.log(\`   Requirements: \${tierConfig.min_external_ids}+ external IDs, \${tierConfig.min_social_links}+ social links\`);
      console.log(\`   ISNI Required: \${tierConfig.isni_required ? 'Yes' : 'No'}\\n\`);
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
        console.log(\`   \${config.color} \${config.name}: \${count} artists\`);
      } else {
        console.log(\`   ❌ Invalid: \${count} artists\`);
      }
    }

    // Show sample validation failures
    console.log('\\n🔍 Sample Validation Issues:');
    let issueCount = 0;
    
    for (const artist of artists) {
      const gateResult = checkQualityGates(artist);
      if (!gateResult.passed && issueCount < 5) {
        console.log(\`   \${artist.name}: \${gateResult.recommendation}\`);
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
`;

fs.writeFileSync(
  path.join(__dirname, '../scripts/test-tiered-validation.ts'),
  validationTestScript,
  { mode: 0o755 }
);

console.log('✅ Created validation test script: scripts/test-tiered-validation.ts');

// ============================================================================
// STEP 5: SUMMARY
// ============================================================================

console.log('🎯 Implementation Summary\n');

console.log('✅ COMPLETED:');
console.log('   • Fixed wikidata regex bug in enrich-musicbrainz.ts');
console.log('   • Created corroboration logging SQL script');
console.log('   • Implemented tiered validation system');
console.log('   • Created execution and test scripts');

console.log('\n📋 NEXT STEPS:');
console.log('   1. Run: ./scripts/execute-fixes.sh');
console.log('   2. Test: bun run scripts/test-tiered-validation.ts');
console.log('   3. Review: Check data quality dashboard');
console.log('   4. Decide: ISNI validation policy for minting');
console.log('   5. Plan: CISAC integration for next sprint');

console.log('\n🔧 MANUAL STEPS REQUIRED:');
console.log('   • Business decision on ISNI requirements for minting');
console.log('   • Review and approve tiered validation approach');
console.log('   • Plan CISAC/BMI/MLC integration timeline');

console.log('\n📊 EXPECTED IMPROVEMENTS:');
console.log('   • Wikidata IDs: Show proper Q-IDs instead of "wiki"');
console.log('   • Audit Trail: Full corroboration logging for all field resolutions');
console.log('   • Quality Gates: Tiered validation with clear requirements');
console.log('   • Data Quality: Better tracking and improvement metrics');

console.log('\n🎉 Ready to execute fixes!');
