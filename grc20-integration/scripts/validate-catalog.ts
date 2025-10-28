/**
 * Validate Catalog Quality
 *
 * Tests current catalog against GRC-20 validation schemas
 * Shows what % of entities are ready to mint
 */

import postgres from 'postgres';
import { config } from '../config';
import { fetchAndValidateArtists, fetchAndValidateWorks } from '../utils/db-to-grc20-mapper';

async function main() {
  console.log('🔍 GRC-20 Catalog Quality Report\n');

  if (!config.neonConnectionString) {
    throw new Error('DATABASE_URL required');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // Test artists
    console.log('=' .repeat(60));
    console.log('📊 ARTISTS');
    console.log('='.repeat(60) + '\n');

    const artistResult = await fetchAndValidateArtists(sql, 1000);

    console.log('\n💡 Common Issues:');
    const artistIssues = new Map<string, number>();
    artistResult.invalid.forEach(({ errors }) => {
      errors.issues.forEach(issue => {
        const key = `${issue.path.join('.')}: ${issue.message}`;
        artistIssues.set(key, (artistIssues.get(key) || 0) + 1);
      });
    });

    Array.from(artistIssues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([issue, count]) => {
        console.log(`   [${count}x] ${issue}`);
      });

    // Test works
    console.log('\n' + '='.repeat(60));
    console.log('📊 WORKS');
    console.log('='.repeat(60) + '\n');

    const workResult = await fetchAndValidateWorks(sql, 1000);

    console.log('\n💡 Common Issues:');
    const workIssues = new Map<string, number>();
    workResult.invalid.forEach(({ errors }) => {
      errors.issues.forEach(issue => {
        const key = `${issue.path.join('.')}: ${issue.message}`;
        workIssues.set(key, (workIssues.get(key) || 0) + 1);
      });
    });

    Array.from(workIssues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([issue, count]) => {
        console.log(`   [${count}x] ${issue}`);
      });

    // Overall summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 OVERALL SUMMARY');
    console.log('='.repeat(60));

    const overallValid = artistResult.stats.validCount + workResult.stats.validCount;
    const overallTotal = artistResult.stats.total + workResult.stats.total;
    const overallPercent = Math.round((overallValid / overallTotal) * 100);

    console.log(`
   Total Entities: ${overallTotal}
   Ready to Mint: ${overallValid} (${overallPercent}%)
   Need Enrichment: ${overallTotal - overallValid}

   Quality Gates:
   ${overallPercent >= 90 ? '✅' : '⚠️ '} Initial Launch (90%+): ${overallPercent}%
   ${overallPercent >= 80 ? '✅' : '⚠️ '} Growth Phase (80%+): ${overallPercent}%
   ${overallPercent >= 70 ? '✅' : '⚠️ '} Mature Catalog (70%+): ${overallPercent}%
    `);

    // Recommendations
    console.log('💡 Recommendations:\n');

    if (artistResult.stats.validPercent < 80) {
      console.log('   📸 Generate missing artist images (fal.ai Seedream)');
    }

    if (artistResult.stats.validPercent < 90) {
      console.log('   🔗 Enrich social links (Instagram, TikTok, Twitter)');
    }

    if (workResult.stats.validPercent < 80) {
      console.log('   👥 Link more composers (MusicBrainz)');
      console.log('   🎵 Add ISWCs where available');
    }

    if (overallPercent >= 80) {
      console.log('   ✅ Catalog quality is good - ready for batch mint!');
    } else {
      console.log('   ⚠️  Focus on enrichment before batch mint');
    }

  } finally {
    await sql.end();
  }
}

main().catch(console.error);
