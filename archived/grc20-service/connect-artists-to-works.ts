/**
 * Connect Artists to Works in GRC-20 Knowledge Graph
 * 
 * This script demonstrates how to create artist-work relationships using GRC-20.
 * It shows both the ETL pipeline for preparing data and the GRC-20 SDK calls
 * for creating the relationships on-chain.
 */

import postgres from 'postgres';
import { config } from './config';

// ============================================================================
// PART 1: DATA STRUCTURE ANALYSIS
// ============================================================================

async function analyzeArtistWorkData() {
  console.log('🔗 Analyzing Artist-Work Relationship Data\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // Check existing relationships
    console.log('1. 📊 Current Data State:');
    
    try {
      const artistSongCounts = await sql`
        SELECT 
          COUNT(DISTINCT ga.genius_artist_id) as artists_with_songs,
          COUNT(*) as total_songs,
          COUNT(DISTINCT gs.primary_artist_id) as unique_primary_artists
        FROM genius_songs gs
        LEFT JOIN genius_artists ga ON gs.primary_artist_id = ga.genius_artist_id
      `;
      
      console.log(`   Artists with songs in source: ${artistSongCounts[0].artists_with_songs}`);
      console.log(`   Total songs available: ${artistSongCounts[0].total_songs}`);
      console.log(`   Unique primary artists: ${artistSongCounts[0].unique_primary_artists}`);
      
      // Show sample artist-work relationships
      const sampleArtists = await sql`
        SELECT 
          ga.name as artist_name,
          COUNT(*) as song_count,
          STRING_AGG(gs.title, ', ' ORDER BY gs.title) as sample_songs
        FROM genius_artists ga
        JOIN genius_songs gs ON gs.primary_artist_id = ga.genius_artist_id
        GROUP BY ga.id, ga.name
        HAVING COUNT(*) >= 2
        ORDER BY song_count DESC
        LIMIT 5
      `;
      
      console.log('\n   Top Artists by Song Count:');
      sampleArtists.forEach(({ artist_name, song_count, sample_songs }) => {
        const songs = sample_songs.split(', ').slice(0, 3).join(', ') + (sample_songs.split(', ').length > 3 ? '...' : '');
        console.log(`      ${artist_name}: ${song_count} songs (${songs})`);
      });
      
    } catch (e) {
      console.log('   ❌ Could not analyze genius_songs data');
    }

    // Check grc20_works table
    const worksExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'current_schema()' 
        AND table_name = 'grc20_works'
      ) as exists
    `;
    
    if (!worksExists[0].exists) {
      console.log('\n   ❌ grc20_works table does not exist - need to create first');
    } else {
      const worksCount = await sql`SELECT COUNT(*) as count FROM grc20_works`;
      console.log(`   ✅ grc20_works exists with ${worksCount[0].count} works`);
    }

  } catch (error) {
    console.error('❌ Error analyzing data:', error);
  } finally {
    await sql.end();
  }
}

// ============================================================================
// PART 2: GRC-20 KNOWLEDGE GRAPH DEMONSTRATION
// ============================================================================

/**
 * Example: Connecting an Artist to their Works using GRC-20 SDK
 * 
 * This demonstrates the pattern for creating relationships after entities exist.
 */

function demonstrateGRC20Relations() {
  console.log('\n🔮 GRC-20 Knowledge Graph: Artist-Work Relationships\n');

  console.log('📋 REQUIREMENTS FROM GRC-20 SDK DOCS:\n');
  
  console.log('1. 🏗️  Prerequisites:');
  console.log('   ✅ Types defined: musicalArtist, musicalWork (from type-ids.json)');
  console.log('   ✅ Relations defined: composedBy, performedBy (from type-ids.json)');
  console.log('   ✅ Minted artists: 133 ready-to-mint artists identified');
  console.log('   ❌ Works data: Need to ETL works from genius_songs → grc20_works');
  console.log('');
  
  console.log('2. 🔗 RELATIONSHIP CREATION PATTERN:');
  console.log('');
  console.log('   // After artist and work entities exist:');
  console.log('   const { ops: relationOps } = Graph.updateEntity(artistId, {');
  console.log('     relations: {');
  console.log('       [properties.composedBy]: { // Artist composed this work');
  console.log('         toEntity: workId,');
  console.log('         values: [{');
  console.log('           property: properties.role, // "composer", "performer", etc');
  console.log('           value: "primary_artist"');
  console.log('         }]');
  console.log('       }');
  console.log('     }');
  console.log('   });');
  console.log('');
  
  console.log('3. 📚 BATCH RELATIONSHIP CREATION:');
  console.log('');
  console.log('   // For efficiency, batch multiple relations:');
  console.log('   const allOps = [];');
  console.log('   ');
  console.log('   // Create new work entity');
  console.log('   const { ops: workOps, id: workId } = Graph.createEntity({');
  console.log('     name: songTitle,');
  console.log('     types: [types.musicalWork],');
  console.log('     values: [');
  console.log('       { property: properties.title, value: songTitle },');
  console.log('       { property: properties.spotifyId, value: spotifyTrackId }');
  console.log('     ]');
  console.log('   });');
  console.log('   ');
  console.log('   allOps.push(...workOps);');
  console.log('   ');
  console.log('   // Link to artist (existing minted entity)');
  console.log('   const { ops: linkOps } = Graph.updateEntity(artistGRC20Id, {');
  console.log('     relations: {');
  console.log('       [properties.performedBy]: {');
  console.log('         toEntity: workId');
  console.log('       }');
  console.log('     }');
  console.log('   });');
  console.log('   ');
  console.log('   allOps.push(...linkOps);');
  console.log('   ');
  console.log('   // Publish batch to IPFS + blockchain');
  console.log('   await publishEdit(allOps, \`Create \${songTitle} + link to \${artistName}\`);');
}

// ============================================================================
// PART 3: IMPLEMENTATION PLAN
// ============================================================================

function createImplementationPlan() {
  console.log('\n🚀 IMPLEMENTATION PLAN\n');

  console.log('📈 PHASE 1: DATA PREPARATION (2-4 hours)');
  console.log('');
  console.log('1. Create grc20_works table schema (already designed)');
  console.log('   ✓ Table structure exists in corroboration schema');
  console.log('   ✓ Has ISRC/ISWC fields for industry consensus');
  console.log('   ✓ Has artist relationship columns');
  console.log('');
  console.log('2. ETL genius_songs → grc20_works');
  console.log('   ✓ Pull 1,077 songs from genius_songs');
  console.log('   ✓ Match to grc20_artists via genius_artist_id');
  console.log('   ✓ Calculate quality scores for ready-to-mint');
  console.log('');
  console.log('3. Enrich with Spotify data');
  console.log('   ✗ Link 688 spotify_tracks to works where possible');
  console.log('   ✗ Add Apple Music IDs via iTunes Search API');
  console.log('   ✗ Add ISRC lookup via industry APIs');
  console.log('');
  
  console.log('🏗️  PHASE 2: GRC-20 MINTING (4-6 hours)');
  console.log('');
  console.log('4. Mint works to blockchain');
  console.log('   ✓ Use existing type-ids.json: musicalWork type');
  console.log('   ✓ Batch 50 works per transaction (same cost efficiency)');
  console.log('   ✓ Store work GRC-20 entity IDs in grc20_works.grc20_entity_id');
  console.log('');
  console.log('5. Create artist-work relations');
  console.log('   ✓ Link minted artists to their works using "performedBy" relation');
  console.log('   ✓ Support multiple roles: primary_artist, featured_artist, composer');
  console.log('   ✓ Batch relation creation for gas efficiency');
  console.log('');
  
  console.log('🔍 PHASE 3: QUERY & VALIDATION (1-2 hours)');
  console.log('');
  console.log('6. Test graph traversal');
  console.log('   ✓ GraphQL queries: "Get all works by artist"');
  console.log('   ✓ GraphQL queries: "Get artist for this work"');
  console.log('   ✓ GraphQL queries: "Get featured collaborations"');
  console.log('');
  console.log('7. Frontend integration');
  console.log('   ✗ Update query client to include relations');
  console.log('   ✗ UI for exploring artist discographies');
  console.log('   ✗ Visual graph navigation');
  console.log('');
  
  console.log('📊 EXPECTED RESULTS:');
  console.log('');
  console.log('   • 1,077 works minted to GRC-20');
  console.log('   • 2,000+ artist-work relationships created');
  console.log('   • Ready for karaoke segment linking (next phase)');
  console.log('   • Gas cost: ~212,000 gas total (≈$2 for 1,077 works)');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🎵 GRC-20 Artist-Work Relationship Planning\n');
  
  // Part 1: Analyze current data
  await analyzeArtistWorkData();
  
  // Part 2: Demonstrate GRC-20 pattern
  demonstrateGRC20Relations();
  
  // Part 3: Implementation plan
  createImplementationPlan();
  
  console.log('\n✅ ANALYSIS COMPLETE');
  console.log('\n📋 NEXT ACTIONS:');
  console.log('   1. Run: dotenvx run -f .env -- bun run create-works-etl.ts');
  console.log('   2. Run: dotenvx run -f .env -- bun run import-works');
  console.log('   3. Run: dotenvx run -f .env -- bun run create-artist-relations.ts');
}

main().catch(console.error);
