/**
 * Data Quality Verification Script
 * 
 * Checks for common data quality issues in grc20_artists and musicbrainz_artists
 * Run regularly to ensure data integrity
 */

import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  console.log('🔍 DATA QUALITY VERIFICATION\n');
  
  // 1. Check for broken YouTube channels
  console.log('📊 YouTube Channel Quality:');
  const ytCheck = await sql`
    SELECT 
      'musicbrainz_artists' as table_name,
      COUNT(*) as total,
      COUNT(youtube_channel) as has_value,
      COUNT(*) FILTER (WHERE youtube_channel IN ('channel', 'user', 'c')) as broken,
      COUNT(*) FILTER (WHERE youtube_channel ~ '^UC[A-Za-z0-9_-]{22}$') as valid_channel_ids,
      COUNT(*) FILTER (WHERE youtube_channel IS NOT NULL AND length(youtube_channel) < 10) as suspicious_short
    FROM musicbrainz_artists
    UNION ALL
    SELECT 
      'grc20_artists' as table_name,
      COUNT(*) as total,
      COUNT(youtube_channel) as has_value,
      COUNT(*) FILTER (WHERE youtube_channel IN ('channel', 'user', 'c')) as broken,
      COUNT(*) FILTER (WHERE youtube_channel ~ '^UC[A-Za-z0-9_-]{22}$') as valid_channel_ids,
      COUNT(*) FILTER (WHERE youtube_channel IS NOT NULL AND length(youtube_channel) < 10) as suspicious_short
    FROM grc20_artists
  `;
  console.table(ytCheck);
  
  // 2. Check for broken Twitter handles
  console.log('\n📊 Twitter Handle Quality:');
  const twCheck = await sql`
    SELECT 
      'musicbrainz_artists' as table_name,
      COUNT(*) as total,
      COUNT(twitter_handle) as has_value,
      COUNT(*) FILTER (WHERE twitter_handle LIKE '%twitter.com%' OR twitter_handle LIKE '%x.com%') as contains_url,
      COUNT(*) FILTER (WHERE twitter_handle LIKE '@%') as has_at_symbol
    FROM musicbrainz_artists
    UNION ALL
    SELECT 
      'grc20_artists' as table_name,
      COUNT(*) as total,
      COUNT(twitter_handle) as has_value,
      COUNT(*) FILTER (WHERE twitter_handle LIKE '%twitter.com%' OR twitter_handle LIKE '%x.com%') as contains_url,
      COUNT(*) FILTER (WHERE twitter_handle LIKE '@%') as has_at_symbol
    FROM grc20_artists
  `;
  console.table(twCheck);
  
  // 3. Check for broken TikTok handles
  console.log('\n📊 TikTok Handle Quality:');
  const ttCheck = await sql`
    SELECT 
      'musicbrainz_artists' as table_name,
      COUNT(*) as total,
      COUNT(tiktok_handle) as has_value,
      COUNT(*) FILTER (WHERE tiktok_handle LIKE '%tiktok.com%') as contains_url,
      COUNT(*) FILTER (WHERE tiktok_handle LIKE '@%') as has_at_symbol
    FROM musicbrainz_artists
    UNION ALL
    SELECT 
      'grc20_artists' as table_name,
      COUNT(*) as total,
      COUNT(tiktok_handle) as has_value,
      COUNT(*) FILTER (WHERE tiktok_handle LIKE '%tiktok.com%') as contains_url,
      COUNT(*) FILTER (WHERE tiktok_handle LIKE '@%') as has_at_symbol
    FROM grc20_artists
  `;
  console.table(ttCheck);
  
  // 4. Platform URL completeness
  console.log('\n📊 Platform URLs:');
  const urlCheck = await sql`
    SELECT 
      COUNT(spotify_url) as spotify,
      COUNT(apple_music_url) as apple_music,
      COUNT(deezer_url) as deezer,
      COUNT(tidal_url) as tidal,
      COUNT(genius_url) as genius
    FROM grc20_artists
  `;
  console.table(urlCheck);
  
  // 5. Overall completeness
  console.log('\n📊 Overall Completeness:');
  const completeness = await sql`
    SELECT 
      'Excellent (>= 0.8)' as score_range,
      COUNT(*) as count
    FROM grc20_artists
    WHERE completeness_score >= 0.8
    UNION ALL
    SELECT 
      'Good (0.6 - 0.8)' as score_range,
      COUNT(*) as count
    FROM grc20_artists
    WHERE completeness_score >= 0.6 AND completeness_score < 0.8
    UNION ALL
    SELECT 
      'Fair (0.4 - 0.6)' as score_range,
      COUNT(*) as count
    FROM grc20_artists
    WHERE completeness_score >= 0.4 AND completeness_score < 0.6
    UNION ALL
    SELECT 
      'Poor (< 0.4)' as score_range,
      COUNT(*) as count
    FROM grc20_artists
    WHERE completeness_score < 0.4
    ORDER BY score_range DESC
  `;
  console.table(completeness);
  
  // 6. Check for issues requiring attention
  console.log('\n⚠️  Issues Requiring Attention:');
  
  const issues = [];
  
  const brokenYT = await sql`SELECT COUNT(*) as c FROM grc20_artists WHERE youtube_channel IN ('channel', 'user', 'c')`;
  if (parseInt(brokenYT[0].c) > 0) {
    issues.push(`❌ ${brokenYT[0].c} broken YouTube channels in grc20_artists`);
  }
  
  const brokenYTMB = await sql`SELECT COUNT(*) as c FROM musicbrainz_artists WHERE youtube_channel IN ('channel', 'user', 'c')`;
  if (parseInt(brokenYTMB[0].c) > 0) {
    issues.push(`⚠️  ${brokenYTMB[0].c} broken YouTube channels in musicbrainz_artists (consider re-enrichment)`);
  }
  
  const urlTW = await sql`SELECT COUNT(*) as c FROM grc20_artists WHERE twitter_handle LIKE '%twitter.com%' OR twitter_handle LIKE '%x.com%'`;
  if (parseInt(urlTW[0].c) > 0) {
    issues.push(`❌ ${urlTW[0].c} Twitter handles contain full URLs`);
  }
  
  if (issues.length === 0) {
    console.log('✅ No critical issues found!');
  } else {
    issues.forEach(issue => console.log(issue));
  }
  
  await sql.end();
  
  console.log('\n✅ Verification complete!');
}

main();
