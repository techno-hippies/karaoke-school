/**
 * Analyze Low-Hanging Fruit for Data Enrichment Pre-Mint
 */

import postgres from 'postgres';
import { config } from './config';

async function main() {
  console.log('🔍 Analyzing Low-Hanging Fruit for Data Enrichment\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // 1. Check what works data exists
    console.log('1. 📚 Works Data Analysis:');
    const worksCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'current_schema()' 
        AND table_name = 'grc20_works'
      ) as works_table_exists
    `;
    
    if (worksCheck[0].works_table_exists) {
      const worksCount = await sql`SELECT COUNT(*) as count FROM grc20_works`;
      console.log(`   grc20_works table: ${worksCount[0].count} works`);
    } else {
      console.log('   ❌ grc20_works table does not exist');
    }
    
    // 2. Check source works data
    console.log('\n2. 📝 Source Works Data:');
    try {
      const geniusSongs = await sql`SELECT COUNT(*) as count FROM genius_songs LIMIT 1`;
      if (geniusSongs.length > 0) {
        console.log(`   genius_songs: ${geniusSongs[0].count} songs`);
      }
      
      const spotifyTracks = await sql`SELECT COUNT(*) as count FROM spotify_tracks LIMIT 1`;
      if (spotifyTracks.length > 0) {
        console.log(`   spotify_tracks: ${spotifyTracks[0].count} tracks`);
      }
    } catch (e) {
      console.log('   ❌ Source works tables not accessible');
    }
    
    // 3. Check artist-work connections in source
    console.log('\n3. 🔗 Existing Artist-Work Connections:');
    try {
      const artistSongs = await sql`
        SELECT COUNT(DISTINCT ga.genius_artist_id) as artists_with_songs,
               COUNT(*) as total_songs
        FROM genius_songs gs
        JOIN genius_artists ga ON gs.primary_artist_id = ga.genius_artist_id
      `;
      console.log(`   Artists with songs: ${artistSongs[0].artists_with_songs}`);
      console.log(`   Total songs: ${artistSongs[0].total_songs}`);
    } catch (e) {
      console.log('   ❌ Could not query artist-song connections');
    }
    
    // 4. External ID coverage gaps
    console.log('\n4. 🆔 External ID Coverage Gaps:');
    
    const idGaps = await sql`
      SELECT 
        COUNT(*) as total_artists,
        COUNT(*) FILTER (WHERE external_id_count < 3) as lt_3_ids,
        COUNT(*) FILTER (WHERE external_id_count < 4) as lt_4_ids,
        COUNT(*) FILTER (WHERE mbid IS NULL) as missing_mbid,
        COUNT(*) FILTER (WHERE spotify_artist_id IS NULL) as missing_spotify,
        COUNT(*) FILTER (WHERE isni IS NULL) as missing_isni
      FROM grc20_artists
    `;
    
    const { total_artists, lt_3_ids, lt_4_ids, missing_mbid, missing_spotify, missing_isni } = idGaps[0];
    console.log(`   Artists with <3 external IDs: ${lt_3_ids} (${((lt_3_ids/total_artists)*100).toFixed(1)}%)`);
    console.log(`   Artists with <4 external IDs: ${lt_4_ids} (${((lt_4_ids/total_artists)*100).toFixed(1)}%)`);
    console.log(`   Missing MBID: ${missing_mbid} (${((missing_mbid/total_artists)*100).toFixed(1)}%)`);
    console.log(`   Missing Spotify: ${missing_spotify} (${((missing_spotify/total_artists)*100).toFixed(1)}%)`);
    console.log(`   Missing ISNI: ${missing_isni} (${((missing_isni/total_artists)*100).toFixed(1)}%)`);
    
    // 5. Social media gaps
    console.log('\n5. 📱 Social Media Gaps:');
    
    const socialGaps = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE instagram_handle IS NULL) as no_instagram,
        COUNT(*) FILTER (WHERE tiktok_handle IS NULL) as no_tiktok,
        COUNT(*) FILTER (WHERE twitter_handle IS NULL AND instagram_handle IS NULL) as no_twitter_instagram
      FROM grc20_artists
    `;
    
    const { total, no_instagram, no_tiktok, no_twitter_instagram } = socialGaps[0];
    console.log(`   No Instagram: ${no_instagram} (${((no_instagram/total)*100).toFixed(1)}%)`);
    console.log(`   No TikTok: ${no_tiktok} (${((no_tiktok/total)*100).toFixed(1)}%)`);
    console.log(`   No Twitter/Instagram: ${no_twitter_instagram} (${((no_twitter_instagram/total)*100).toFixed(1)}%)`);
    
    // 6. Easy wins for reaching next tier
    console.log('\n6. 🎯 Easy Wins for Tier Improvement:');
    
    const nearStandard = await sql`
      SELECT 
        SUM(CASE WHEN external_id_count = 4 THEN 1 ELSE 0 END) as need_1_more_id,
        SUM(CASE WHEN social_link_count = 2 THEN 1 ELSE 0 END) as need_1_more_social,
        SUM(CASE WHEN completeness_score >= 0.68 AND completeness_score < 0.70 THEN 1 ELSE 0 END) as near_completeness
      FROM grc20_artists
      WHERE ready_to_mint = FALSE
    `;
    
    const { need_1_more_id, need_1_more_social, near_completeness } = nearStandard[0];
    console.log(`   Need 1 more external ID for Standard tier: ${need_1_more_id}`);
    console.log(`   Need 1 more social link for Standard tier: ${need_1_more_social}`);
    console.log(`   Near completeness threshold: ${near_completeness}`);
    
    // 7. Sample artists closest to next tier
    console.log('\n7. 📋 Sample Artists Close to Next Tier:');
    
    const closeToUpgrade = await sql`
      SELECT 
        name,
        external_id_count,
        social_link_count,
        completeness_score,
        CASE 
          WHEN isni IS NOT NULL AND external_id_count >= 5 AND social_link_count >= 3 THEN 'Premium'
          WHEN external_id_count >= 3 AND social_link_count >= 2 AND completeness_score >= 0.70 THEN 'Standard'  
          WHEN genius_artist_id IS NOT NULL AND image_url IS NOT NULL AND social_link_count >= 1 THEN 'Minimal'
          ELSE 'Invalid'
        END as current_tier,
        CASE 
          WHEN external_id_count = 4 THEN 'Add 1 external ID (Discogs, Wikidata, etc.)'
          WHEN social_link_count = 2 THEN 'Add 1 social link (YouTube, SoundCloud)'
          WHEN completeness_score >= 0.68 THEN 'Complete remaining fields'
          ELSE 'Multiple improvements needed'
        END as next_step
      FROM grc20_artists
      WHERE ready_to_mint = FALSE
        AND external_id_count >= 3
        AND completeness_score >= 0.60
      ORDER BY (external_id_count + social_link_count + completeness_score) DESC
      LIMIT 10
    `;
    
    closeToUpgrade.forEach(({ name, current_tier, next_step }) => {
      console.log(`   ${name}: ${current_tier} → ${next_step}`);
    });
    
    // 8. Recommendations
    console.log('\n8. 💡 RECOMMENDATIONS FOR LOW-HANGING FRUIT:');
    console.log('');
    console.log('🎯 IMMEDIATE WINS (1-2 hours):');
    console.log('   1. Add Discogs IDs to 100+ artists via Discogs API');
    console.log('   2. Complete YouTube/SoundCloud handles for 50+ artists');
    console.log('   3. Set up grc20_works table schema for artist-work connections');
    console.log('');
    console.log('🔄 NEXT PHASE (1-2 days):');
    console.log('   1. ETL works from genius_songs to grc20_works');
    console.log('   2. Link artists to their works (1:N relationships)');
    console.log('   3. Add Apple Music IDs via iTunes Search API');
    console.log('');
    console.log('📈 LONG-TERM (1 week):');
    console.log('   1. MusicBrainz enrichment for missing MBIDs');
    console.log('   2. ISNI lookup via VIAF/ISNI databases');
    console.log('   3. Automated social media discovery APIs');

  } catch (error) {
    console.error('❌ Error analyzing data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
