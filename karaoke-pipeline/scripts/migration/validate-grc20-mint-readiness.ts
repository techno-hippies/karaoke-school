/**
 * Validate GRC-20 Mint Readiness
 *
 * Comprehensive validation script that:
 * 1. Checks data integrity (existing validate-grc20-data.ts functionality)
 * 2. Validates mint readiness using Zod schemas
 * 3. Identifies blockers with actionable recommendations
 * 4. Provides minting statistics and progress tracking
 */

import { query } from '../../src/db/neon';
import {
  validateArtistMintReadiness,
  GET_ARTISTS_READY_TO_MINT_QUERY,
  GET_ARTIST_MINT_STATS_QUERY
} from '../../src/schemas/grc20-artist-mint';
import {
  validateWorkMintReadiness,
  GET_WORKS_READY_TO_MINT_QUERY,
  GET_WORK_MINT_STATS_QUERY,
  GET_BLOCKED_WORKS_QUERY
} from '../../src/schemas/grc20-work-mint';

interface ValidationReport {
  dataIntegrity: {
    passed: boolean;
    issues: string[];
  };
  mintReadiness: {
    artists: {
      total: number;
      minted: number;
      ready: number;
      blocked: number;
      validationPassed: number;
      validationFailed: number;
    };
    works: {
      total: number;
      minted: number;
      ready: number;
      blocked: number;
      validationPassed: number;
      validationFailed: number;
    };
  };
  blockers: {
    artists: Array<{ name: string; reason: string }>;
    works: Array<{ title: string; reason: string; details?: any }>;
  };
  recommendations: string[];
}

async function checkDataIntegrity(): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];

  // 1. Check for duplicate ISWCs
  const duplicateIswcs = await query(`
    SELECT iswc, COUNT(*) as count, STRING_AGG(id::text || ': ' || title, ', ') as works
    FROM grc20_works
    WHERE iswc IS NOT NULL
    GROUP BY iswc
    HAVING COUNT(*) > 1
  `);

  if (duplicateIswcs.length > 0) {
    duplicateIswcs.forEach((row: any) => {
      issues.push(`Duplicate ISWC ${row.iswc}: ${row.count} works (${row.works})`);
    });
  }

  // 2. Check for orphaned works (missing artists)
  const orphanedWorks = await query(`
    SELECT gw.id, gw.title, gw.primary_artist_id
    FROM grc20_works gw
    LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
    WHERE gw.primary_artist_id IS NOT NULL
      AND ga.id IS NULL
  `);

  if (orphanedWorks.length > 0) {
    issues.push(`${orphanedWorks.length} works with broken artist references`);
  }

  // 3. Check for works without recordings
  const worksWithoutRecordings = await query(`
    SELECT gw.id, gw.title
    FROM grc20_works gw
    LEFT JOIN grc20_work_recordings gwr ON gwr.work_id = gw.id
    WHERE gwr.id IS NULL
  `);

  if (worksWithoutRecordings.length > 0) {
    issues.push(`${worksWithoutRecordings.length} works without recordings (1:1 relationship broken)`);
  }

  return {
    passed: issues.length === 0,
    issues
  };
}

async function validateArtistReadiness() {
  const stats = await query(GET_ARTIST_MINT_STATS_QUERY);
  const readyArtists = await query(GET_ARTISTS_READY_TO_MINT_QUERY);

  let validationPassed = 0;
  let validationFailed = 0;
  const failures: Array<{ name: string; reason: string }> = [];

  for (const artist of readyArtists) {
    const validation = validateArtistMintReadiness(artist);
    if (validation.success) {
      validationPassed++;
    } else {
      validationFailed++;
      failures.push({
        name: artist.name,
        reason: validation.missingFields?.join(', ') || 'Unknown validation error'
      });
    }
  }

  return {
    stats: stats[0],
    validationPassed,
    validationFailed,
    failures
  };
}

async function validateWorkReadiness() {
  const stats = await query(GET_WORK_MINT_STATS_QUERY);
  const readyWorks = await query(GET_WORKS_READY_TO_MINT_QUERY);

  let validationPassed = 0;
  let validationFailed = 0;
  const failures: Array<{ title: string; reason: string; details?: any }> = [];

  for (const work of readyWorks) {
    // Parse recordings JSONB
    const workWithRecordings = {
      ...work,
      recordings: typeof work.recordings === 'string'
        ? JSON.parse(work.recordings)
        : work.recordings
    };

    const validation = validateWorkMintReadiness(workWithRecordings);
    if (validation.success) {
      validationPassed++;
    } else {
      validationFailed++;
      failures.push({
        title: work.title,
        reason: validation.blockers?.join(', ') || validation.missingFields?.join(', ') || 'Unknown',
        details: {
          iswc: work.iswc,
          artist_id: work.primary_artist_id,
          recordings_count: workWithRecordings.recordings?.length || 0
        }
      });
    }
  }

  return {
    stats: stats[0],
    validationPassed,
    validationFailed,
    failures
  };
}

async function getBlockers() {
  const blockedArtists = await query(`
    SELECT name, blocker_reason as reason
    FROM grc20_artists_blocked
    ORDER BY
      CASE WHEN blocker_reason LIKE '%image%' THEN 1 ELSE 2 END,
      name
    LIMIT 10
  `);

  const blockedWorks = await query(GET_BLOCKED_WORKS_QUERY);

  return {
    artists: blockedArtists.map((a: any) => ({ name: a.name, reason: a.reason })),
    works: blockedWorks.slice(0, 10).map((w: any) => ({
      title: w.title,
      reason: w.blocker_reason,
      details: {
        iswc: w.iswc,
        recordings: w.recording_count,
        recordings_with_image: w.recordings_with_image
      }
    }))
  };
}

async function generateRecommendations(report: ValidationReport): Promise<string[]> {
  const recommendations: string[] = [];

  // Data integrity issues
  if (!report.dataIntegrity.passed) {
    recommendations.push('⚠️  Fix data integrity issues before minting:');
    report.dataIntegrity.issues.forEach(issue => {
      recommendations.push(`   - ${issue}`);
    });
    recommendations.push('   Run: bun scripts/migration/wipe-grc20-tables.ts && re-populate');
  }

  // Missing ISWCs
  const missingIswc = report.blockers.works.filter(w => w.reason.includes('ISWC')).length;
  if (missingIswc > 0) {
    recommendations.push(`🔍 Discover ISWCs for ${missingIswc} works:`);
    recommendations.push('   Run: bun run unified --step=3 --limit=50 (ISWC discovery)');
  }

  // Missing artist images
  if (report.blockers.artists.length > 0) {
    const missingImages = report.blockers.artists.filter(a => a.reason.includes('image')).length;
    if (missingImages > 0) {
      recommendations.push(`🖼️  Generate images for ${missingImages} artists:`);
      recommendations.push('   Run: bun run unified --step=12 --asset=artist --limit=20');
    }
  }

  // Missing work images
  const missingWorkImages = report.blockers.works.filter(w => w.reason.includes('image')).length;
  if (missingWorkImages > 0) {
    recommendations.push(`🖼️  Generate images for ${missingWorkImages} works:`);
    recommendations.push('   Run: bun run unified --step=12 --asset=track --limit=20');
  }

  // Ready to mint!
  if (report.mintReadiness.artists.validationPassed > 0 || report.mintReadiness.works.validationPassed > 0) {
    recommendations.push('');
    recommendations.push('✅ Ready to mint:');
    if (report.mintReadiness.artists.validationPassed > 0) {
      recommendations.push(`   - ${report.mintReadiness.artists.validationPassed} artists`);
    }
    if (report.mintReadiness.works.validationPassed > 0) {
      recommendations.push(`   - ${report.mintReadiness.works.validationPassed} works`);
    }
    recommendations.push('   Next: Create minting script using GRC-20 SDK');
  }

  return recommendations;
}

async function main() {
  console.log('🔍 GRC-20 Mint Readiness Validation\n');
  console.log('═'.repeat(70));

  const report: ValidationReport = {
    dataIntegrity: { passed: true, issues: [] },
    mintReadiness: {
      artists: { total: 0, minted: 0, ready: 0, blocked: 0, validationPassed: 0, validationFailed: 0 },
      works: { total: 0, minted: 0, ready: 0, blocked: 0, validationPassed: 0, validationFailed: 0 }
    },
    blockers: { artists: [], works: [] },
    recommendations: []
  };

  // Step 1: Data Integrity
  console.log('\n1️⃣  DATA INTEGRITY');
  report.dataIntegrity = await checkDataIntegrity();
  if (report.dataIntegrity.passed) {
    console.log('   ✅ No integrity issues');
  } else {
    console.log(`   ❌ ${report.dataIntegrity.issues.length} issues found:`);
    report.dataIntegrity.issues.forEach(issue => console.log(`      - ${issue}`));
  }

  // Step 2: Artist Readiness
  console.log('\n2️⃣  ARTIST MINT READINESS');
  const artistReadiness = await validateArtistReadiness();
  report.mintReadiness.artists = {
    total: parseInt(artistReadiness.stats.total),
    minted: parseInt(artistReadiness.stats.minted),
    ready: parseInt(artistReadiness.stats.ready_to_mint),
    blocked: parseInt(artistReadiness.stats.blocked_missing_image),
    validationPassed: artistReadiness.validationPassed,
    validationFailed: artistReadiness.validationFailed
  };

  console.log(`   Total:     ${report.mintReadiness.artists.total}`);
  console.log(`   Minted:    ${report.mintReadiness.artists.minted}`);
  console.log(`   Ready:     ${report.mintReadiness.artists.ready} (${report.mintReadiness.artists.validationPassed} passed Zod validation)`);
  console.log(`   Blocked:   ${report.mintReadiness.artists.blocked}`);

  if (artistReadiness.validationFailed > 0) {
    console.log(`\n   ⚠️  ${artistReadiness.validationFailed} artists failed Zod validation:`);
    artistReadiness.failures.slice(0, 3).forEach((f: any) => {
      console.log(`      - ${f.name}: ${f.reason}`);
    });
  }

  // Step 3: Work Readiness
  console.log('\n3️⃣  WORK MINT READINESS');
  const workReadiness = await validateWorkReadiness();
  report.mintReadiness.works = {
    total: parseInt(workReadiness.stats.total),
    minted: parseInt(workReadiness.stats.minted),
    ready: parseInt(workReadiness.stats.ready_to_mint),
    blocked: parseInt(workReadiness.stats.blocked_missing_iswc) + parseInt(workReadiness.stats.blocked_missing_image),
    validationPassed: workReadiness.validationPassed,
    validationFailed: workReadiness.validationFailed
  };

  console.log(`   Total:             ${report.mintReadiness.works.total}`);
  console.log(`   Minted:            ${report.mintReadiness.works.minted}`);
  console.log(`   Ready:             ${report.mintReadiness.works.ready} (${report.mintReadiness.works.validationPassed} passed Zod validation)`);
  console.log(`   Blocked (ISWC):    ${workReadiness.stats.blocked_missing_iswc}`);
  console.log(`   Blocked (Image):   ${workReadiness.stats.blocked_missing_image}`);

  if (workReadiness.validationFailed > 0) {
    console.log(`\n   ⚠️  ${workReadiness.validationFailed} works failed Zod validation:`);
    workReadiness.failures.slice(0, 3).forEach((f: any) => {
      console.log(`      - ${f.title}: ${f.reason}`);
    });
  }

  // Step 4: Blockers
  console.log('\n4️⃣  BLOCKERS (Top 10)');
  report.blockers = await getBlockers();

  if (report.blockers.works.length > 0) {
    console.log('\n   Works:');
    report.blockers.works.slice(0, 5).forEach(w => {
      console.log(`   - ${w.title}`);
      console.log(`     Reason: ${w.reason}`);
      if (w.details?.iswc === null) {
        console.log(`     ISWC: missing`);
      }
    });
  }

  if (report.blockers.artists.length > 0) {
    console.log('\n   Artists:');
    report.blockers.artists.slice(0, 5).forEach(a => {
      console.log(`   - ${a.name}: ${a.reason}`);
    });
  }

  // Step 5: Recommendations
  console.log('\n5️⃣  RECOMMENDATIONS');
  report.recommendations = await generateRecommendations(report);
  report.recommendations.forEach(rec => console.log(`   ${rec}`));

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 SUMMARY');
  console.log(`   Artists: ${report.mintReadiness.artists.validationPassed} ready, ${report.mintReadiness.artists.blocked} blocked`);
  console.log(`   Works:   ${report.mintReadiness.works.validationPassed} ready, ${report.mintReadiness.works.blocked} blocked`);

  const overallReady = report.mintReadiness.artists.validationPassed > 0 && report.mintReadiness.works.validationPassed > 0;
  if (overallReady) {
    console.log('\n✅ READY TO MINT!');
    console.log('   Next: Implement minting script using @graphprotocol/grc-20 SDK\n');
  } else {
    console.log('\n⏳ NOT READY - See recommendations above\n');
  }

  // Exit code
  process.exit(report.dataIntegrity.passed ? 0 : 1);
}

main().catch(err => {
  console.error('\n❌ Validation error:', err.message);
  process.exit(1);
});
